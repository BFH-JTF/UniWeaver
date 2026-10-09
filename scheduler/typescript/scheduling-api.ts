/**
 * Types and a minimal client for the uniweaver scheduling service
 * (org.uniweaver.scheduling). Mirrors ScheduleRequest / ScheduleResponse
 * in the Java project 1:1 - keep both in sync by hand, or generate this file
 * from the service's OpenAPI output (springdoc-openapi) if you add it later.
 */

export type Weekday =
  | "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY" | "SATURDAY" | "SUNDAY";

export interface AvailabilityWindowDTO {
  weekId: string;
  dayOfWeek: Weekday;
  startTime: string; // "HH:mm:ss"
  endTime: string;
}

export interface RoomDTO {
  id: string;
  name: string;
  roomType: string;
  capacity: number;
  availability?: AvailabilityWindowDTO[];
}

export interface LecturerDTO {
  id: string;
  name: string;
  availability?: AvailabilityWindowDTO[];
}

export interface TimeSlotDTO {
  id: string;
  weekId: string;
  dayOfWeek: Weekday;
  startTime: string;
  endTime: string;
}

/** One MODULE-unit occurrence a CLASS_ENTITY needs scheduled. Generate
 *  MODULE.unitsPerWeek of these per module+class pairing before calling solve(). */
export interface SessionRequestDTO {
  id: string;
  moduleId: string;
  moduleName?: string;
  classId: string;
  className?: string;
  studentCount: number;
  durationMinutes: number;
  sequenceIndex: number;
  /** subset of lecturer ids qualified for this module, from MODULE.lecturerIds */
  lecturerCandidateIds: string[];
}

export interface SchedulingRuleDTO {
  id: string;
  ruleType: string;
  category?: string;
  weight: number;
  enabled: boolean;
  params?: Record<string, unknown>;
  appliesTo?: string[];
}

export interface ScheduleRequest {
  semesterId: string;
  rooms: RoomDTO[];
  lecturers: LecturerDTO[];
  timeSlots: TimeSlotDTO[];
  sessions: SessionRequestDTO[];
  schedulingRules?: SchedulingRuleDTO[];
}

export interface SessionResultDTO {
  id: string;
  moduleId: string;
  moduleName?: string;
  classId: string;
  className?: string;
  assigned: boolean;
  timeSlotId?: string;
  weekId?: string;
  dayOfWeek?: Weekday;
  startTime?: string;
  endTime?: string;
  roomId?: string;
  roomName?: string;
  lecturerId?: string;
  lecturerName?: string;
}

export type SolverStatus = "NOT_SOLVING" | "SOLVING_SCHEDULED" | "SOLVING_ACTIVE";

export interface ScheduleResponse {
  jobId: string;
  semesterId: string;
  solverStatus: SolverStatus;
  score: { hardScore: number; softScore: number; feasible: boolean };
  sessions: SessionResultDTO[];
}

export class SchedulingClient {
  constructor(private baseUrl: string) {}

  /** Submits a problem and returns immediately with a jobId; solving continues in the background. */
  async solve(request: ScheduleRequest): Promise<ScheduleResponse> {
    const res = await fetch(`${this.baseUrl}/api/schedules`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
    if (!res.ok) throw new Error(`Solve request failed: ${res.status}`);
    return res.json();
  }

  /** Fetches the current best solution + solver status for a job. */
  async getSchedule(jobId: string): Promise<ScheduleResponse> {
    const res = await fetch(`${this.baseUrl}/api/schedules/${jobId}`);
    if (!res.ok) throw new Error(`Fetch schedule failed: ${res.status}`);
    return res.json();
  }

  /** Stops solving early and returns whatever was found so far. */
  async stop(jobId: string): Promise<ScheduleResponse> {
    const res = await fetch(`${this.baseUrl}/api/schedules/${jobId}`, { method: "DELETE" });
    if (!res.ok) throw new Error(`Stop request failed: ${res.status}`);
    return res.json();
  }

  /** Convenience: poll until solverStatus is NOT_SOLVING (or timeout). */
  async solveAndWait(request: ScheduleRequest, pollMs = 1000, timeoutMs = 60_000): Promise<ScheduleResponse> {
    const { jobId } = await this.solve(request);
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const result = await this.getSchedule(jobId);
      if (result.solverStatus === "NOT_SOLVING") return result;
      await new Promise((r) => setTimeout(r, pollMs));
    }
    throw new Error(`Timed out waiting for job ${jobId}`);
  }
}
