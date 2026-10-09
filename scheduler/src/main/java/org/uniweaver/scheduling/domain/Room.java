package org.uniweaver.scheduling.domain;

import java.util.List;

import ai.timefold.solver.core.api.domain.lookup.PlanningId;

/**
 * Slimmed-down mirror of ROOM: only the fields the solver actually reasons about
 * (capacity, availability). Layout/equipment/connectivity/accessibility/maintenance
 * stay in your app's own data store - if you later need e.g. "room must have a
 * projector", add that field here and a matching constraint.
 */
public class Room {

    @PlanningId
    private String id;

    private String name;
    private String roomType;
    private int capacity;
    private List<AvailabilityWindow> availability;

    public Room() {
    }

    public Room(String id, String name, String roomType, int capacity, List<AvailabilityWindow> availability) {
        this.id = id;
        this.name = name;
        this.roomType = roomType;
        this.capacity = capacity;
        this.availability = availability;
    }

    /** True if there's no availability data (assumed open) or a window covers the slot. See AvailabilityWindow. */
    public boolean isAvailableDuring(TimeSlot slot) {
        if (availability == null || availability.isEmpty()) {
            return true;
        }
        return availability.stream().anyMatch(w -> w.covers(slot));
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getRoomType() {
        return roomType;
    }

    public void setRoomType(String roomType) {
        this.roomType = roomType;
    }

    public int getCapacity() {
        return capacity;
    }

    public void setCapacity(int capacity) {
        this.capacity = capacity;
    }

    public List<AvailabilityWindow> getAvailability() {
        return availability;
    }

    public void setAvailability(List<AvailabilityWindow> availability) {
        this.availability = availability;
    }

    @Override
    public String toString() {
        return name;
    }
}
