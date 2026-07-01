require("dotenv").config();
const app = require("./App");
const { checkSlaBreaches, autoCloseResolvedTickets } = require("./utils/slaChecker");
const { runAutoAssign } = require("./utils/autoAssign");
const { runShiftEndNotifications } = require("./utils/shiftEndCron");

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);

  // Periodic SLA breach check (README §9). Interval configurable via env.
  const intervalMs = Number(process.env.SLA_CHECK_INTERVAL_MS) || 5 * 60 * 1000;
  const runSla = async () => {
    try {
      const n = await checkSlaBreaches();
      if (n > 0) console.log(`SLA check: marked ${n} ticket(s) as breached`);
      const c = await autoCloseResolvedTickets();
      if (c > 0) console.log(`Auto-close: closed ${c} resolved ticket(s)`);
    } catch (err) {
      console.error("SLA/auto-close job failed:", err.message);
    }
  };
  setInterval(runSla, intervalMs);
  runSla(); // run once at startup

  // Shift-based auto-assignment (Airoli / Hansa Direct IT only). Polls the
  // external roster and assigns/reassigns scoped tickets. Disable with
  // AUTO_ASSIGN_ENABLED=false; interval via AUTO_ASSIGN_INTERVAL_MS (default 1m).
  if (process.env.AUTO_ASSIGN_ENABLED !== "false") {
    const autoAssignMs = Number(process.env.AUTO_ASSIGN_INTERVAL_MS) || 60 * 1000;
    const runAuto = async () => {
      try {
        await runAutoAssign();
      } catch (err) {
        console.error("Auto-assign job failed:", err.message);
      }
    };
    setInterval(runAuto, autoAssignMs);
    runAuto(); // run once at startup

    // Shift-ending summary emails (spec Task 5.4): notify people ~30 min before
    // their shift ends. Poll every ~5 min. Same enable flag as auto-assign.
    const shiftEndMs = Number(process.env.SHIFT_END_INTERVAL_MS) || 5 * 60 * 1000;
    const runShiftEnd = async () => {
      try {
        await runShiftEndNotifications();
      } catch (err) {
        console.error("Shift-end job failed:", err.message);
      }
    };
    setInterval(runShiftEnd, shiftEndMs);
    runShiftEnd(); // run once at startup
  }
});