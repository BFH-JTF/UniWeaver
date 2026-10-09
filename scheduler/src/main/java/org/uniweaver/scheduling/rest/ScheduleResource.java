package org.uniweaver.scheduling.rest;

import java.time.Duration;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

import org.uniweaver.scheduling.domain.Schedule;
import org.uniweaver.scheduling.rest.dto.ScheduleRequest;
import org.uniweaver.scheduling.rest.dto.ScheduleResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import ai.timefold.solver.core.config.solver.SolverConfig;
import ai.timefold.solver.core.api.solver.SolverFactory;
import ai.timefold.solver.core.api.solver.SolverManager;
import ai.timefold.solver.core.api.solver.SolverStatus;
import jakarta.validation.Valid;

/**
 * Solving is async by design (a semester-sized timetable can take from seconds to
 * minutes), so this follows Timefold's recommended "submit a job, poll for status"
 * pattern rather than blocking the HTTP request until solving finishes:
 *
 *   1. POST /api/schedules            -> 202 Accepted + jobId, solving starts in the background
 *   2. GET  /api/schedules/{jobId}     -> current best solution so far + solverStatus
 *   3. DELETE /api/schedules/{jobId}   -> stop early and return whatever was found
 *
 * jobIdToSchedule is an in-memory map, fine for a single-instance prototype. For
 * production, back it with a real store (DB/Redis) so jobs survive a restart and
 * multiple instances of this service can share state.
 */
@RestController
@RequestMapping("/api/schedules")
public class ScheduleResource {

    private final SolverManager<Schedule, String> solverManager;
    private final ConcurrentMap<String, Schedule> jobIdToSchedule = new ConcurrentHashMap<>();

    public ScheduleResource(SolverManager<Schedule, String> solverManager) {
        this.solverManager = solverManager;
    }

    @PostMapping
    public ResponseEntity<ScheduleResponse> solve(@RequestBody @Valid ScheduleRequest request) {
        String jobId = UUID.randomUUID().toString();
        Schedule problem = ScheduleMapper.toDomain(request);
        jobIdToSchedule.put(jobId, problem);

        // Per-request termination override: callers control how long the solver
        // may refine the solution (longer runs yield potentially better scores).
        SolverConfig override = new SolverConfig();
        if (request.getTerminationSpentLimitSeconds() != null
                && request.getTerminationSpentLimitSeconds() > 0) {
            override.withTerminationSpentLimit(Duration.ofSeconds(request.getTerminationSpentLimitSeconds()));
            SolverFactory<Schedule, String> factory = SolverFactory.create(override);
            factory.solve(jobId, problem, finalBestSchedule -> jobIdToSchedule.put(jobId, finalBestSchedule));
        } else {
            solverManager.solve(jobId, problem, finalBestSchedule -> jobIdToSchedule.put(jobId, finalBestSchedule));
        }

        ScheduleResponse response = ScheduleMapper.toResponse(jobId, problem, solverManager.getSolverStatus(jobId));
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(response);
    }

    @GetMapping("/{jobId}")
    public ResponseEntity<ScheduleResponse> getSchedule(@PathVariable String jobId) {
        Schedule schedule = jobIdToSchedule.get(jobId);
        if (schedule == null) {
            return ResponseEntity.notFound().build();
        }
        SolverStatus status = solverManager.getSolverStatus(jobId);
        return ResponseEntity.ok(ScheduleMapper.toResponse(jobId, schedule, status));
    }

    @DeleteMapping("/{jobId}")
    public ResponseEntity<ScheduleResponse> stopSolving(@PathVariable String jobId) {
        Schedule schedule = jobIdToSchedule.get(jobId);
        if (schedule == null) {
            return ResponseEntity.notFound().build();
        }
        solverManager.terminateEarly(jobId);
        return ResponseEntity.ok(ScheduleMapper.toResponse(jobId, schedule, solverManager.getSolverStatus(jobId)));
    }
}
