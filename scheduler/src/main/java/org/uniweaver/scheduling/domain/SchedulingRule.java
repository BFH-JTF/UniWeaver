package org.uniweaver.scheduling.domain;

import java.util.List;
import java.util.Map;

/**
 * Mirror of SCHEDULING_RULE. ruleType is your app's external constraint catalog key
 * (open-ended by design in the ERD), so this service can't auto-generate a constraint
 * for every possible ruleType. What it does instead: read enabled rules by ruleType
 * inside ScheduleConstraintProvider and turn the ones you care about into real
 * constraints, weighted by SchedulingRule.weight. One example (minGapBetweenUnits)
 * is wired up already - copy that pattern for the rest of your catalog.
 */
public class SchedulingRule {

    private String id;
    private String ruleType;
    private String category;
    private int weight;
    private boolean enabled;
    private String semesterId;
    private Map<String, Object> params;
    private List<String> appliesTo;

    public SchedulingRule() {
    }

    public SchedulingRule(String id, String ruleType, String category, int weight, boolean enabled,
            String semesterId, Map<String, Object> params, List<String> appliesTo) {
        this.id = id;
        this.ruleType = ruleType;
        this.category = category;
        this.weight = weight;
        this.enabled = enabled;
        this.semesterId = semesterId;
        this.params = params;
        this.appliesTo = appliesTo;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getRuleType() {
        return ruleType;
    }

    public void setRuleType(String ruleType) {
        this.ruleType = ruleType;
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public int getWeight() {
        return weight;
    }

    public void setWeight(int weight) {
        this.weight = weight;
    }

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public String getSemesterId() {
        return semesterId;
    }

    public void setSemesterId(String semesterId) {
        this.semesterId = semesterId;
    }

    public Map<String, Object> getParams() {
        return params;
    }

    public void setParams(Map<String, Object> params) {
        this.params = params;
    }

    public List<String> getAppliesTo() {
        return appliesTo;
    }

    public void setAppliesTo(List<String> appliesTo) {
        this.appliesTo = appliesTo;
    }
}
