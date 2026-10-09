package org.uniweaver.scheduling.domain;

import java.util.List;

import ai.timefold.solver.core.api.domain.lookup.PlanningId;

/**
 * Slimmed-down mirror of LECTURER. userId/departmentId stay in your app's own
 * store; the solver only needs identity + availability. moduleIds (qualification)
 * is not carried here - it's resolved per-session into SessionAssignment's
 * lecturerCandidates list by the mapper, so the solver's search space is already
 * restricted to qualified lecturers before it starts (see SessionAssignment).
 */
public class Lecturer {

    @PlanningId
    private String id;

    private String name;
    private List<AvailabilityWindow> availability;

    public Lecturer() {
    }

    public Lecturer(String id, String name, List<AvailabilityWindow> availability) {
        this.id = id;
        this.name = name;
        this.availability = availability;
    }

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
