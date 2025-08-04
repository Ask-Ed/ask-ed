import { defineApp } from 'convex/server'
import betterAuth from '@convex-dev/better-auth/convex.config'
import agent from '@convex-dev/agent/convex.config'
import workflow from "@convex-dev/workflow/convex.config"

const app = defineApp()
app.use(betterAuth)
app.use(agent)
app.use(workflow)
export default app