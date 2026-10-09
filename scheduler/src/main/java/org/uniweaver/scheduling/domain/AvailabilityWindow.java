package org.uniweaver.scheduling.domain;

import java.time.DayOfWeek;
import java.time.LocalTime;
import java.util.Objects;

/**
 * One open window during which a room or lecturer is available.
 * Same shape as both ROOM_AVAILABILITY and LECTURER_AVAILABILITY in the ERD
 * (weekId + weekday + startTime + endTime), so both reuse this class rather
 * than duplicating it - it's attached as a list on {@link Room} and {@link Lecturer}.
 * <p>
 * ASSUMPTION: an availability row is an "available during this window" allow-list,
 * not a blackout. A room/lecturer with an empty availability list is treated as
 * available at all times (no constraint entered for it yet). If your semantics are
 * actually a blackout/unavailability list, flip the check in Room#isAvailableDuring
 * and Lecturer#isAvailableDuring from "any window covers the slot" to
 * "no window overlaps the slot".
 */
public class AvailabilityWindow {

    private String weekId;
    private DayOfWeek dayOfWeek;
    private LocalTime startTime;
    private LocalTime endTime;

    public AvailabilityWindow() {
    }

    public AvailabilityWindow(String weekId, DayOfWeek dayOfWeek, LocalTime startTime, LocalTime endTime) {
        this.weekId = weekId;
        this.dayOfWeek = dayOfWeek;
        this.startTime = startTime;
        this.endTime = endTime;
    }

    /** True if this window fully covers the given slot's time range. */
    public boolean covers(TimeSlot slot) {
        return Objects.equals(this.weekId, slot.getWeekId())
                && this.dayOfWeek == slot.getDayOfWeek()
                && !this.startTime.isAfter(slot.getStartTime())
                && !this.endTime.isBefore(slot.getEndTime());
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
}
