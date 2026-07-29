import 'dotenv/config'

import express from 'express'
import { createServer } from 'node:http'
import { Server } from 'socket.io'
import { initializePatientIo } from './listeners/patient-io'
import { initializeStaffIo } from './listeners/staff-io'
import { registrationRouter } from './route/registration'
import { logger } from './logger'
const port = process.env.PORT || 8000
const clientURL = process.env.CLIENT_URL
const app = express()
const server = createServer(app)

const io = new Server(server, {
  cors: {
    origin: clientURL,
  },
})

app.get('/', (req, res) => {
  res.json('Server is running')
})

app.use('/api/registration', registrationRouter)

const patientIo = io.of('/patient')
const staffIo = io.of('/staff')

initializeStaffIo(staffIo)
initializePatientIo(patientIo)

server.listen(port, () => {
  logger.info(`server listening on port ${port}`)
})
