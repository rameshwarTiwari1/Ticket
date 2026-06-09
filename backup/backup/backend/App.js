const express = require("express");
const app = express();
const cors = require('cors');
const dotenv = require('dotenv');
const userRoutes = require('./routers/userRoutes');
const teamRoutes = require('./routers/teamRoutes');
const issueRoutes = require('./routers/issueRoutes')
const otpRoutes = require('./routers/otpRoutes');
const typeRoutes = require('./routers/typeRoutes');
const ticketStatusRouter = require('./routers/statusRouter');
const ticketgenerate = require('./routers/ticketRoutes');
const locationRoutes = require('./routers/locationRouter');
const wingRoutes = require('./routers/wingRoutes');
const clientRoutes = require('./routers/clientRoutes');
const authRoutes = require('./routers/auth.routes');
const organizationRoutes = require('./routers/organizationRoutes');
const approverRoutes = require('./routers/approverRoutes');
const notificationRoutes = require('./routers/notificationRoutes');
const activityRoutes = require('./routers/activityRoutes');

const path = require('path');

const routeMap = {
  userRoutes,
  teamRoutes,
  issueRoutes,
  otpRoutes,
  typeRoutes,
  ticketStatusRouter,
  ticketgenerate,
  locationRoutes,
  wingRoutes,
  clientRoutes,
  authRoutes,
  organizationRoutes,
  approverRoutes,
  notificationRoutes,
  activityRoutes,
};

Object.entries(routeMap).forEach(([name, r]) => {
  if (typeof r !== 'function') {
    console.error(`❌ BROKEN ROUTE: ${name} is ${typeof r}`, r);
  } else {
    console.log(`✅ OK: ${name}`);
  }
});

app.use(express.json());
require('dotenv').config();
// app.use(cors({
//   origin: [
//     'http://192.168.5.39:3000',
//     'http://192.168.5.39:4200'
//   ],
//   credentials: true
// }));
// ✅ Fixed — added all origins including bare IP (port 80)
// ✅ FIXED App.js CORS section

app.use(cors({
  origin: [
    'http://192.168.5.39',
    'http://192.168.5.39:80',
    'http://192.168.5.39:3000',
    'http://192.168.5.39:4200',
'http://192.168.5.245',
    'http://192.168.5.245:80',
    'http://192.168.5.245:8080',
    'http://192.168.5.245:4200',
    'http://localhost:4200',
    'http://localhost:53453'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// ✅ Correct preflight handler — no wildcard '*'
app.options('/{*path}', cors());

app.use('/api/users', userRoutes); ////users
app.get('/', (req, res) => res.send('Backend is running!'));
app.use('/api/teams', teamRoutes); /////teams
app.use('/api/issues', issueRoutes);  /////issues
app.use('/api/otp', otpRoutes); ////otp
app.use('/api/types', typeRoutes); /////type
app.use('/api/ticket-status', ticketStatusRouter); //// ticket status
app.use('/api/tickets-generate', ticketgenerate);  ///////ticketgenerate
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/api/locations', locationRoutes);
app.use('/api/wings', wingRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/organizations', organizationRoutes);
app.use('/api/approvers', approverRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/activity-logs', activityRoutes);

module.exports = app;
