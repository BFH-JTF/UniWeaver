package org.uniweaver.scheduling.solver;

import static ai.timefold.solver.core.api.score.stream.Joiners.equal;
import static ai.timefold.solver.core.api.score.stream.Joiners.filtering;

import ai.timefold.solver.core.api.score.buildin.hardsoft.HardSoftScore;
import ai.timefold.solver.core.api.score.stream.Constraint;
import ai.timefold.solver.core.api.score.stream.ConstraintFactory;
import ai.timefold.solver.core.api.score.stream.ConstraintProvider;
import ai.timefold.solver.core.api.score.stream.uni.UniConstraintStream;
import org.uniweaver.scheduling.domain.SchedulingRule;
import org.uniweaver.scheduling.domain.SessionAssignment;

/**
 * All scheduling rules live here, expressed against the SessionAssignment /
 * Room / Lecturer / TimeSlot / SchedulingRule facts in the domain package.
 * HardSoftScore: any hard-constraint violation makes a solution infeasible
 * regardless of how good its soft score is; soft constraints only compete
 * against each other once all hard constraints are satisfied.
 */
public class ScheduleConstraintProvider implements ConstraintProvider {

    @Override
    public Constraint[] defineConstraints(ConstraintFactory factory) {
        return new Constraint[] {
                // hard: physical/logical impossibilities
                roomConflict(factory),
                lecturerConflict(factory),
                classConflict(factory),
                roomCapacity(factory),
                roomAvailability(factory),
                lecturerAvailability(factory),
                // soft: preferences, cheapest to relax first when things get tight
                lecturerRoomStability(factory),
                schedulingRuleMinGapBetweenUnits(factory),
        };
    }

    // ---- hard constraints -------------------------------------------------

    /** Two sessions can't use the same room at overlapping times. */
    private Constraint roomConflict(ConstraintFactory factory) {
        return factory.forEachUniquePair(SessionAssignment.class, equal(SessionAssignment::getRoom))
                .filter((a, b) -> a.getRoom() != null
                        && a.getTimeSlot() != null && b.getTimeSlot() != null
                        && a.getTimeSlot().overlaps(b.getTimeSlot()))
                .penalize(HardSoftScore.ONE_HARD)
                .asConstraint("Room conflict");
    }

    /** A lecturer can't teach two sessions at overlapping times. */
    private Constraint lecturerConflict(ConstraintFactory factory) {
        return factory.forEachUniquePair(SessionAssignment.class, equal(SessionAssignment::getLecturer))
                .filter((a, b) -> a.getLecturer() != null
                        && a.getTimeSlot() != null && b.getTimeSlot() != null
                        && a.getTimeSlot().overlaps(b.getTimeSlot()))
                .penalize(HardSoftScore.ONE_HARD)
                .asConstraint("Lecturer conflict");
    }

    /** A class can't attend two sessions at overlapping times. classId is fixed, not a planning variable. */
    private Constraint classConflict(ConstraintFactory factory) {
        return factory.forEachUniquePair(SessionAssignment.class, equal(SessionAssignment::getClassId))
                .filter((a, b) -> a.getTimeSlot() != null && b.getTimeSlot() != null
                        && a.getTimeSlot().overlaps(b.getTimeSlot()))
                .penalize(HardSoftScore.ONE_HARD)
                .asConstraint("Class conflict");
    }

    /** A room must fit the class it's hosting. Penalty scales with how far over capacity it is. */
    private Constraint roomCapacity(ConstraintFactory factory) {
        return factory.forEach(SessionAssignment.class)
                .filter(s -> s.getRoom() != null && s.getRoom().getCapacity() < s.getStudentCount())
                .penalize(HardSoftScore.ONE_HARD,
                        s -> s.getStudentCount() - s.getRoom().getCapacity())
                .asConstraint("Room too small");
    }

    /** A room can only host a session inside one of its declared availability windows. */
    private Constraint roomAvailability(ConstraintFactory factory) {
        return factory.forEach(SessionAssignment.class)
                .filter(s -> s.getRoom() != null && s.getTimeSlot() != null
                        && !s.getRoom().isAvailableDuring(s.getTimeSlot()))
                .penalize(HardSoftScore.ONE_HARD)
                .asConstraint("Room not available at that time");
    }

    /** A lecturer can only teach during one of their declared availability windows. */
    private Constraint lecturerAvailability(ConstraintFactory factory) {
        return factory.forEach(SessionAssignment.class)
                .filter(s -> s.getLecturer() != null && s.getTimeSlot() != null
                        && !s.getLecturer().isAvailableDuring(s.getTimeSlot()))
                .penalize(HardSoftScore.ONE_HARD)
                .asConstraint("Lecturer not available at that time");
    }

    // ---- soft constraints ---------------------------------------------------

    /** Prefer a lecturer to teach all their sessions in the same room (less to-and-fro). */
    private Constraint lecturerRoomStability(ConstraintFactory factory) {
        return factory.forEachUniquePair(SessionAssignment.class, equal(SessionAssignment::getLecturer))
                .filter((a, b) -> a.getLecturer() != null
                        && a.getRoom() != null && b.getRoom() != null
                        && a.getRoom() != b.getRoom())
                .penalize(HardSoftScore.ONE_SOFT)
                .asConstraint("Lecturer room stability");
    }

    /**
     * Example of turning a generic SCHEDULING_RULE row into a live, weighted constraint:
     * looks for enabled rules with ruleType "minGapBetweenUnits" whose appliesTo list
     * contains a module, and penalizes (weighted by the rule's weight) two units of
     * that module landing on the same day. Copy this pattern per ruleType in your catalog.
     */
    private Constraint schedulingRuleMinGapBetweenUnits(ConstraintFactory factory) {
        UniConstraintStream<SchedulingRule> minGapRules = factory.forEach(SchedulingRule.class)
                .filter(r -> r.isEnabled() && "minGapBetweenUnits".equals(r.getRuleType()));

        return factory.forEachUniquePair(SessionAssignment.class, equal(SessionAssignment::getModuleId))
                .join(minGapRules,
                        filtering((a, b, rule) -> rule.getAppliesTo() != null
                                && rule.getAppliesTo().contains(a.getModuleId())))
                .filter((a, b, rule) -> a.getTimeSlot() != null && b.getTimeSlot() != null
                        && a.getTimeSlot().getWeekId().equals(b.getTimeSlot().getWeekId())
                        && a.getTimeSlot().getDayOfWeek() == b.getTimeSlot().getDayOfWeek())
                .penalize(HardSoftScore.ONE_SOFT, (a, b, rule) -> rule.getWeight())
                .asConstraint("Scheduling rule: min gap between same-module units");
    }
}
