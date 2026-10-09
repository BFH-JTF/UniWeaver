package org.uniweaver.scheduling.domain;

import java.time.DayOfWeek;
import java.time.LocalTime;
import java.util.Objects;

import ai.timefold.solver.core.api.domain.lookup.PlanningId;

/**
 * A candidate slot a {@link SessionAssignment} can be placed into: one concrete
 * (week, weekday, start, end) combination, mirroring the weekId + weekday + startTime
 * + endTime columns that a SCHEDULE_ENTRY carries once a session has been placed.
 * <p>
 * The caller (the TypeScript app) is responsible for generating the candidate list -
 * e.g. from WEEK rows crossed with a daily time grid derived from SCHEDULING_RULE /
 * business-hours config. The solver only ever picks among the slots you hand it.
 * <p>
 * NOTE: intentionally does not override equals()/hashCode() - Timefold identifies
 * planning facts by reference, and overriding equality on classes used inside a
 * value range is a well-known footgun. Two logically identical slots must be the
 * exact same Java object; the mapper layer guarantees that by building one instance
 * per (weekId, weekday, start, end) and reusing it everywhere it's referenced.
 */
public class TimeSlot {

    @PlanningId
    private String id;

    private String weekId;
    private DayOfWeek dayOfWeek;
    private LocalTime startTime;
    private LocalTime endTime;

    public TimeSlot() {
    }

    public TimeSlot(String id, String weekId, DayOfWeek dayOfWeek, LocalTime startTime, LocalTime endTime) {
        this.id = id;
        this.weekId = weekId;
        this.dayOfWeek = dayOfWeek;
        this.startTime = startTime;
        this.endTime = endTime;
    }

    /** True if this slot and {@code other} are in the same week + weekday and their time ranges overlap. */
    public boolean overlaps(TimeSlot other) {
        if (other == null) {
            return false;
        }
        if (!Objects.equals(this.weekId, other.weekId) || this.dayOfWeek != other.dayOfWeek) {
            return false;
        }
        return this.startTime.isBefore(other.endTime) && other.startTime.isBefore(this.endTime);
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getWeekId() {
        return weekId;
    }

    public void setWeekId(String weekId) {
        this.weekId = weekId;
    }

    public DayOfWeek getDayOfWeek() {
        return dayOfWeek;
    }

    public void setDayOfWeek(DayOfWeek dayOfWeek) {
        this.dayOfWeek = dayOfWeek;
    }

    public LocalTime getStartTime() {
        return startTime;
    }

    public void setStartTime(LocalTime startTime) {
        this.startTime = startTime;
    }

    public LocalTime getEndTime() {
        return endTime;
    }

    public void setEndTime(LocalTime endTime) {
        this.endTime = endTime;
    }

    @Override
    public String toString() {
        return weekId + " " + dayOfWeek + " " + startTime + "-" + endTime;
    }
}
