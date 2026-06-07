require("dotenv").config();
const app = require("./App");
const { checkSlaBreaches, autoCloseResolvedTickets } = require("./utils/slaChecker");

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
});