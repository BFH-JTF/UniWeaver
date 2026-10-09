package org.uniweaver.scheduling.rest;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.uniweaver.scheduling.domain.AvailabilityWindow;
import org.uniweaver.scheduling.domain.Lecturer;
import org.uniweaver.scheduling.domain.Room;
import org.uniweaver.scheduling.domain.Schedule;
import org.uniweaver.scheduling.domain.SchedulingRule;
import org.uniweaver.scheduling.domain.SessionAssignment;
import org.uniweaver.scheduling.domain.TimeSlot;
import org.uniweaver.scheduling.rest.dto.ScheduleRequest;
import org.uniweaver.scheduling.rest.dto.ScheduleRequest.AvailabilityWindowDTO;
import org.uniweaver.scheduling.rest.dto.ScheduleRequest.LecturerDTO;
import org.uniweaver.scheduling.rest.dto.ScheduleRequest.RoomDTO;
import org.uniweaver.scheduling.rest.dto.ScheduleRequest.SchedulingRuleDTO;
import org.uniweaver.scheduling.rest.dto.ScheduleRequest.SessionRequestDTO;
import org.uniweaver.scheduling.rest.dto.ScheduleRequest.TimeSlotDTO;
import org.uniweaver.scheduling.rest.dto.ScheduleResponse;
import org.uniweaver.scheduling.rest.dto.ScheduleResponse.ScoreDTO;
import org.uniweaver.scheduling.rest.dto.ScheduleResponse.SessionResultDTO;

import ai.timefold.solver.core.api.solver.SolverStatus;

public final class ScheduleMapper {

    private ScheduleMapper() {
    }

    /** Builds the Timefold Schedule (problem facts + planning entities) from an incoming request. */
    public static Schedule toDomain(ScheduleRequest request) {
        List<Room> rooms = request.getRooms().stream()
                .map(ScheduleMapper::toRoom)
                .collect(Collectors.toList());

        Map<String, Lecturer> lecturersById = request.getLecturers().stream()
                .map(ScheduleMapper::toLecturer)
                .collect(Collectors.toMap(Lecturer::getId, l -> l));

        List<TimeSlot> timeSlots = request.getTimeSlots().stream()
                .map(ScheduleMapper::toTimeSlot)
                .collect(Collectors.toList());

        List<SchedulingRule> rules = request.getSchedulingRules() == null
                ? List.of()
                : request.getSchedulingRules().stream().map(ScheduleMapper::toRule).collect(Collectors.toList());

        List<SessionAssignment> sessions = new ArrayList<>();
        for (SessionRequestDTO s : request.getSessions()) {
            List<Lecturer> candidates = s.lecturerCandidateIds.stream()
                    .map(lecturersById::get)
                    .filter(java.util.Objects::nonNull)
                    .collect(Collectors.toList());
            sessions.add(new SessionAssignment(s.id, s.moduleId, s.moduleName, s.classId, s.className,
                    s.studentCount, s.durationMinutes, s.sequenceIndex, candidates));
        }

        return new Schedule(request.getSemesterId(), rooms, timeSlots, rules, sessions);
    }

    /** Turns the current (possibly still-solving) Schedule back into a REST response. */
    public static ScheduleResponse toResponse(String jobId, Schedule schedule, SolverStatus status) {
        ScheduleResponse response = new ScheduleResponse();
        response.jobId = jobId;
        response.semesterId = schedule.getSemesterId();
        response.solverStatus = status.name();

        ScoreDTO scoreDTO = new ScoreDTO();
        if (schedule.getScore() != null) {
            scoreDTO.hardScore = schedule.getScore().hardScore();
            scoreDTO.softScore = schedule.getScore().softScore();
            scoreDTO.feasible = schedule.getScore().hardScore() >= 0;
        }
        response.score = scoreDTO;

        response.sessions = schedule.getSessionAssignments().stream()
                .map(ScheduleMapper::toSessionResult)
                .collect(Collectors.toList());
        return response;
    }

    private static Room toRoom(RoomDTO dto) {
        List<AvailabilityWindow> windows = dto.availability == null ? List.of()
                : dto.availability.stream().map(ScheduleMapper::toWindow).collect(Collectors.toList());
        return new Room(dto.id, dto.name, dto.roomType, dto.capacity, windows);
    }

    private static Lecturer toLecturer(LecturerDTO dto) {
        List<AvailabilityWindow> windows = dto.availability == null ? List.of()
                : dto.availability.stream().map(ScheduleMapper::toWindow).collect(Collectors.toList());
        return new Lecturer(dto.id, dto.name, windows);
    }

    private static AvailabilityWindow toWindow(AvailabilityWindowDTO dto) {
        return new AvailabilityWindow(dto.weekId, dto.dayOfWeek, dto.startTime, dto.endTime);
    }

    private static TimeSlot toTimeSlot(TimeSlotDTO dto) {
        return new TimeSlot(dto.id, dto.weekId, dto.dayOfWeek, dto.startTime, dto.endTime);
    }

    private static SchedulingRule toRule(SchedulingRuleDTO dto) {
        return new SchedulingRule(dto.id, dto.ruleType, dto.category, dto.weight, dto.enabled,
                null, dto.params, dto.appliesTo);
    }

    private static SessionResultDTO toSessionResult(SessionAssignment s) {
        SessionResultDTO dto = new SessionResultDTO();
        dto.id = s.getId();
        dto.moduleId = s.getModuleId();
        dto.moduleName = s.getModuleName();
        dto.classId = s.getClassId();
        dto.className = s.getClassName();
        dto.assigned = s.isFullyAssigned();

        if (s.getTimeSlot() != null) {
            dto.timeSlotId = s.getTimeSlot().getId();
            dto.weekId = s.getTimeSlot().getWeekId();
            dto.dayOfWeek = s.getTimeSlot().getDayOfWeek();
            dto.startTime = s.getTimeSlot().getStartTime();
            dto.endTime = s.getTimeSlot().getEndTime();
        }
        if (s.getRoom() != null) {
            dto.roomId = s.getRoom().getId();
            dto.roomName = s.getRoom().getName();
        }
        if (s.getLecturer() != null) {
            dto.lecturerId = s.getLecturer().getId();
            dto.lecturerName = s.getLecturer().getName();
        }
        return dto;
    }
}
