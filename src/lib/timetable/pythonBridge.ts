import { spawn } from "child_process";
import path from "path";
import fs from "fs";

export interface SolverPayload {
  sections: { id: string; name: string }[];
  slots: { slot_number: number; is_break: boolean }[];
  rooms: {
    id: string;
    room_number: string;
    type: "classroom" | "lab" | "seminar_hall" | "other";
    is_available: boolean;
  }[];
  working_days: string[];
  allocations: {
    section_id: string;
    subject_id: string;
    subject_name: string;
    subject_code: string;
    subject_type: "theory" | "practical";
    teacher_id: string;
    teacher_name: string;
    weekly_hours: number;
    batch_group?: string | null;
  }[];
  existing_busy?: {
    teachers?: { teacher_id: string; day: string; slot_number: number }[];
    rooms?: { room_id?: string | null; day: string; slot_number: number }[];
  };
  max_solve_time_seconds?: number;
  preferences?: {
    max_theory_per_day?: number;
    allow_consecutive_theory?: boolean;
  };
}

export interface SolverEntry {
  section_id: string;
  subject_id: string;
  teacher_id: string;
  room_id: string;
  room_number: string;
  day_of_week: string;
  slot_number: number;
  batch_group?: string | null;
  subject_name?: string;
  subject_code?: string;
  subject_type?: string;
  teacher_name?: string;
}

export interface SolverResponse {
  status: "OPTIMAL" | "FEASIBLE" | "INFEASIBLE" | "UNKNOWN" | "MODEL_INVALID" | "ERROR";
  success?: boolean;
  wall_time_seconds?: number;
  scheduled_units?: number;
  total_periods_scheduled?: number;
  entries?: SolverEntry[];
  error?: string;
  diagnostics?: any;
}

/**
 * Finds the valid Python binary capable of running OR-Tools.
 * Checks local virtual environment first, then system paths.
 */
function getPythonBinaryPath(): string {
  // Use environment variable if provided, or dynamic venv path
  if (process.env.PYTHON_SOLVER_PATH && fs.existsSync(process.env.PYTHON_SOLVER_PATH)) {
    return process.env.PYTHON_SOLVER_PATH;
  }

  const venvDir = [".", "venv"].join("");
  const venvPy = path.join(process.cwd(), venvDir, "bin", "python3");
  if (fs.existsSync(venvPy)) return venvPy;

  const homebrewPy = "/opt/homebrew/opt/python@3.12/bin/python3.12";
  if (fs.existsSync(homebrewPy)) return homebrewPy;

  return "python3";
}

/**
 * Executes the Python OR-Tools CP-SAT solver process.
 */
export async function runOrToolsSolver(payload: SolverPayload): Promise<SolverResponse> {
  const pythonPath = getPythonBinaryPath();
  const scriptPath = path.join(process.cwd(), "src", "server", "python", "timetable_solver.py");

  if (!fs.existsSync(scriptPath)) {
    return {
      status: "ERROR",
      error: `Solver script not found at ${scriptPath}`,
    };
  }

  return new Promise((resolve) => {
    // @ts-ignore - Turbopack ignore dynamic filesystem tracing
    const child = spawn(/*turbopackIgnore: true*/ pythonPath, [scriptPath], {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env },
    });

    let stdoutData = "";
    let stderrData = "";

    child.stdout.on("data", (chunk) => {
      stdoutData += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderrData += chunk.toString();
    });

    child.on("error", (err) => {
      resolve({
        status: "ERROR",
        error: `Failed to spawn Python solver process: ${err.message}`,
      });
    });

    child.on("close", (code) => {
      if (code !== 0 && !stdoutData.trim()) {
        resolve({
          status: "ERROR",
          error: stderrData || `Solver exited with code ${code}`,
        });
        return;
      }

      try {
        const parsed = JSON.parse(stdoutData.trim());
        resolve(parsed);
      } catch (err: any) {
        resolve({
          status: "ERROR",
          error: `Failed to parse solver response JSON: ${err.message}. Raw output: ${stdoutData.slice(0, 300)}`,
        });
      }
    });

    // Write input payload to stdin and close
    child.stdin.write(JSON.stringify(payload));
    child.stdin.end();
  });
}
