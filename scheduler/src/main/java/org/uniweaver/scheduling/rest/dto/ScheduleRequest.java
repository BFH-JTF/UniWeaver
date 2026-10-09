package org.uniweaver.scheduling.rest.dto;

import java.time.DayOfWeek;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

/**
 * What the TypeScript app POSTs to /api/schedules to kick off a solve.
 * All IDs here are your own uniweaver IDs (ROOM.id, LECTURER.id, ...) -
 * they're echoed straight back in the response so you can re-attach the full
 * curriculum objects (MODULE, CLASS_ENTITY, ...) on your side.
 */
public class ScheduleRequest {

    @NotBlank
    private String semesterId;

    @NotEmpty
    @Valid
    private List<RoomDTO> rooms;

    @NotEmpty
    @Valid
    private List<LecturerDTO> lecturers;

    @NotEmpty
    @Valid
    private List<TimeSlotDTO> timeSlots;

    @NotEmpty
    @Valid
    private List<SessionRequestDTO> sessions;

    private List<SchedulingRuleDTO> schedulingRules;

    /**
     * Optional per-request termination override (seconds). When present the
     * solver stops after this spent time instead of the configured default.
     * Longer runs generally produce better solutions, so callers decide.
     */
    private Integer terminationSpentLimitSeconds;

    public String getSemesterId() {
        return semesterId;
    }

    public void setSemesterId(String semesterId) {
        this.semesterId = semesterId;
    }

    public Integer getTerminationSpentLimitSeconds() {
        return terminationSpentLimitSeconds;
    }

    public void setTerminationSpentLimitSeconds(Integer terminationSpentLimitSeconds) {
        this.terminationSpentLimitSeconds = terminationSpentLimitSeconds;
    }

    public List<RoomDTO> getRooms() {
        return rooms;
    }

    public void setRooms(List<RoomDTO> rooms) {
        this.rooms = rooms;
    }

    public List<LecturerDTO> getLecturers() {
        return lecturers;
    }

    public void setLecturers(List<LecturerDTO> lecturers) {
        this.lecturers = lecturers;
    }

    public List<TimeSlotDTO> getTimeSlots() {
        return timeSlots;
    }

    public void setTimeSlots(List<TimeSlotDTO> timeSlots) {
        this.timeSlots = timeSlots;
    }

    public List<SessionRequestDTO> getSessions() {
        return sessions;
    }

    public void setSessions(List<SessionRequestDTO> sessions) {
        this.sessions = sessions;
    }

    public List<SchedulingRuleDTO> getSchedulingRules() {
        return schedulingRules;
    }

    public void setSchedulingRules(List<SchedulingRuleDTO> schedulingRules) {
        this.schedulingRules = schedulingRules;
    }

    // ---- nested DTOs --------------------------------------------------

    public static class RoomDTO {
        @NotBlank
        public String id;
        public String name;
        public String roomType;
        public int capacity;
        public List<AvailabilityWindowDTO> availability;
    }

    public static class LecturerDTO {
        @NotBlank
        public String id;
        public String name;
        public List<AvailabilityWindowDTO> availability;
    }

    public static class AvailabilityWindowDTO {
        @NotBlank
        public String weekId;
        @NotNull
        public DayOfWeek dayOfWeek;
        @NotNull
        public LocalTime startTime;
        @NotNull
        public LocalTime endTime;
    }

    public static class TimeSlotDTO {
        @NotBlank
        public String id;
        @NotBlank
        public String weekId;
        @NotNull
        public DayOfWeek dayOfWeek;
        @NotNull
        public LocalTime startTime;
        @NotNull
        public LocalTime endTime;
    }

    /** One MODULE-unit occurrence a CLASS_ENTITY needs scheduled. Your app generates
     *  MODULE.unitsPerWeek of these per module+class pairing before calling this API. */
    public static class SessionRequestDTO {
        @NotBlank
        public String id;
        @NotBlank
        public String moduleId;
        public String moduleName;
        @NotBlank
        public String classId;
        public String className;
        public int studentCount;
        public int durationMinutes;
        public int sequenceIndex;
        /** Subset of lecturers.id this session may be taught by - resolve from MODULE.lecturerIds. */
        @NotEmpty
        public List<String> lecturerCandidateIds;
    }

    public static class SchedulingRuleDTO {
        public String id;
        public String ruleType;
        public String category;
        public int weight;
        public boolean enabled;
        public Map<String, Object> params;
        public List<String> appliesTo;
    }
}
