package org.uniweaver.scheduling.domain;

import java.util.List;

import ai.timefold.solver.core.api.domain.solution.PlanningEntityCollectionProperty;
import ai.timefold.solver.core.api.domain.solution.PlanningScore;
import ai.timefold.solver.core.api.domain.solution.PlanningSolution;
import ai.timefold.solver.core.api.domain.solution.ProblemFactCollectionProperty;
import ai.timefold.solver.core.api.domain.valuerange.ValueRangeProvider;
import ai.timefold.solver.core.api.score.buildin.hardsoft.HardSoftScore;

/**
 * The planning solution: one whole timetabling problem (typically, one semester)
 * plus the solver's current best answer to it. This is the object SolverManager
 * works on; the REST layer hands one of these to solve() and reads it back out.
 */
@PlanningSolution
public class Schedule {

    private String semesterId;

    @ProblemFactCollectionProperty
    @ValueRangeProvider(id = "roomRange")
    private List<Room> rooms;

    @ProblemFactCollectionProperty
    @ValueRangeProvider(id = "timeSlotRange")
    private List<TimeSlot> timeSlots;

    @ProblemFactCollectionProperty
    private List<SchedulingRule> schedulingRules;

    @PlanningEntityCollectionProperty
    private List<SessionAssignment> sessionAssignments;

    @PlanningScore
    private HardSoftScore score;

    public Schedule() {
    }

    public Schedule(String semesterId, List<Room> rooms, List<TimeSlot> timeSlots,
            List<SchedulingRule> schedulingRules, List<SessionAssignment> sessionAssignments) {
        this.semesterId = semesterId;
        this.rooms = rooms;
        this.timeSlots = timeSlots;
        this.schedulingRules = schedulingRules;
        this.sessionAssignments = sessionAssignments;
    }

    public String getSemesterId() {
        return semesterId;
    }

    public void setSemesterId(String semesterId) {
        this.semesterId = semesterId;
    }

    public List<Room> getRooms() {
        return rooms;
    }

    public void setRooms(List<Room> rooms) {
        this.rooms = rooms;
    }

    public List<TimeSlot> getTimeSlots() {
        return timeSlots;
    }

    public void setTimeSlots(List<TimeSlot> timeSlots) {
        this.timeSlots = timeSlots;
    }

    public List<SchedulingRule> getSchedulingRules() {
        return schedulingRules;
    }

    public void setSchedulingRules(List<SchedulingRule> schedulingRules) {
        this.schedulingRules = schedulingRules;
    }

    public List<SessionAssignment> getSessionAssignments() {
        return sessionAssignments;
    }

    public void setSessionAssignments(List<SessionAssignment> sessionAssignments) {
        this.sessionAssignments = sessionAssignments;
    }

    public HardSoftScore getScore() {
        return score;
    }

    public void setScore(HardSoftScore score) {
        this.score = score;
    }
}
