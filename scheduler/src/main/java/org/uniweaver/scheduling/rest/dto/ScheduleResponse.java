package org.uniweaver.scheduling.rest.dto;

import java.time.DayOfWeek;
import java.time.LocalTime;
import java.util.List;

/**
 * What GET/POST /api/schedules/{jobId} returns. Poll this until solverStatus is
 * "NOT_SOLVING" (Timefold's SolverStatus enum) - at that point score is final and
 * every SessionResultDTO should have assigned=true if the problem was feasible
 * (score.hard == 0).
 */
public class ScheduleResponse {

    public String jobId;
    public String semesterId;
    public String solverStatus;
    public ScoreDTO score;
    public List<SessionResultDTO> sessions;

    public static class ScoreDTO {
        public int hardScore;
        public int softScore;
        public boolean feasible;
    }

    public static class SessionResultDTO {
        public String id;
        public String moduleId;
        public String moduleName;
        public String classId;
        public String className;
        public boolean assigned;

        // null until the solver has placed this session
        public String timeSlotId;
        public String weekId;
        public DayOfWeek dayOfWeek;
        public LocalTime startTime;
        public LocalTime endTime;
        public String roomId;
        public String roomName;
        public String lecturerId;
        public String lecturerName;
    }
}
