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

import ai.timefold.solver.core.api.solver.SolverConfigOverride;
import ai.timefold.solver.core.api.solver.SolverJob;
import ai.timefold.solver.core.api.solver.SolverJobBuilder;
import ai.timefold.solver.core.api.solver.SolverManager;
import ai.timefold.solver.core.api.solver.SolverStatus;
import jakarta.validation.Valid;

/**
 * Solving is async by design (a semester-sized timetable can take from seconds to
 * minutes), so this follows Timefold's "submit a job, poll for status" pattern
 * rather than blocking the HTTP request until solving finishes:
 *
 *   1. POST /api/schedules            -> 202 Accepted + jobId, solving starts in the background
 *   2. GET  /api/schedules/{jobId}     -> current best solution so far + solverStatus
 *   3. DELETE /api/schedules/{jobId}   -> stop early and return whatever was found
 *
 * The per-request termination limit (terminationSpentLimitSeconds) is the user's
 * "how long should the solver think?" control: longer runs can find better
 * solutions. When absent, the application.yml default applies.
 *
 * jobIdToSchedule is an in-memory map, fine for a single-instance deployment.
 */
@RestController
@RequestMapping("/api/schedules")
public class ScheduleResource {

    private final SolverManager<Schedule, String> solverManager;
    private final ConcurrentMap<String, Schedule> jobIdToSchedule = new ConcurrentHashMap<>();
    private final ConcurrentMap<String, SolverJob<Schedule, String>> jobs = new ConcurrentHashMap<>();

    public ScheduleResource(SolverManager<Schedule, String> solverManager) {
        this.solverManager = solverManager;
    }

    @PostMapping
    public ResponseEntity<ScheduleResponse> solve(@RequestBody @Valid ScheduleRequest request) {
        String jobId = UUID.randomUUID().toString();
        Schedule problem = ScheduleMapper.toDomain(request);
        jobIdToSchedule.put(jobId, problem);

        Integer limit = request.getTerminationSpentLimitSeconds();
        SolverJobBuilder<Schedule, String> builder = solverManager.solveBuilder()
                .withProblemId(jobId)
                .withProblem(problem)
                .withFinalBestSolutionEventConsumer(finalBest -> jobIdToSchedule.put(jobId, finalBest.solution()));
        if (limit != null && limit > 0) {
            // User-chosen "how long should the solver think?" override.
            builder.withConfigOverride(new SolverConfigOverride<Schedule>()
                    .withTerminationSpentLimit(Duration.ofSeconds(limit)));
        }
        SolverJob<Schedule, String> job = builder.run();
        jobs.put(jobId, job);

        ScheduleResponse response = ScheduleMapper.toResponse(jobId, problem, job.getSolverStatus());
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(response);
    }

    @GetMapping("/{jobId}")
    public ResponseEntity<ScheduleResponse> getSchedule(@PathVariable String jobId) {
        Schedule schedule = jobIdToSchedule.get(jobId);
        if (schedule == null) {
            return ResponseEntity.notFound().build();
        }
        SolverJob<Schedule, String> job = jobs.get(jobId);
        SolverStatus status = job != null ? job.getSolverStatus() : SolverStatus.NOT_SOLVING;
        return ResponseEntity.ok(ScheduleMapper.toResponse(jobId, schedule, status));
    }

    @DeleteMapping("/{jobId}")
    public ResponseEntity<ScheduleResponse> stopSolving(@PathVariable String jobId) {
        Schedule schedule = jobIdToSchedule.get(jobId);
        if (schedule == null) {
            return ResponseEntity.notFound().build();
        }
        SolverJob<Schedule, String> job = jobs.get(jobId);
        if (job != null) {
            job.terminateEarly();
        }
        return ResponseEntity.ok(ScheduleMapper.toResponse(jobId, schedule, SolverStatus.NOT_SOLVING));
    }
}