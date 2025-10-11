# Database Schema Documentation

## Overview

Elova uses Supabase PostgreSQL with native authentication (`auth.users`) and Row Level Security (RLS) to ensure data isolation between users.

## Core Tables

### 1. `providers`
Stores connected automation platforms (n8n, Zapier, Make.com, etc.).

**Key Fields:**
- `user_id`: References `auth.users(id)` - ensures user isolation
- `type`: ENUM of supported provider types
- `api_key_encrypted`: Encrypted API credentials (never sent to client)
- `status`: Health status (`healthy`, `warning`, `error`, `unknown`)
- `is_connected`: Connection status flag

### 2. `workflows` 
Stores workflow information synchronized from providers.

**Key Fields:**
- `provider_workflow_id`: Original workflow ID from the provider
- `total_executions`, `success_count`, `failure_count`: Auto-calculated stats
- `success_rate`: Percentage success rate
- `graph`: JSONB field for workflow structure/visualization

### 3. `executions`
Stores execution history and results.

**Key Fields:**
- `provider_execution_id`: Original execution ID from provider
- `status`: ENUM (`running`, `success`, `error`, `canceled`, `waiting`, `unknown`)
- `duration`: Execution time in milliseconds
- `error_message`: Error details if failed
- `mode`: How execution was triggered (`manual`, `trigger`, `webhook`, `cron`)

### 4. `endpoint_checks`
For monitoring external endpoints/webhooks.

**Key Fields:**
- `url`: Endpoint to monitor
- `method`: HTTP method (GET, POST, etc.)
- `expected_status`: Expected HTTP status code
- `interval_minutes`: Check frequency

### 5. `endpoint_results`
Results of endpoint monitoring checks.

### 6. `user_preferences`
User-specific settings and preferences.

**Key Fields:**
- `default_time_range`: User's preferred time range for dashboards
- `theme`: UI theme preference
- `notify_*`: Notification preferences

## Custom Types (ENUMs)

```sql
provider_type: 'n8n', 'zapier', 'make', 'pipedream', 'other'
provider_status: 'healthy', 'warning', 'error', 'unknown'
execution_status: 'running', 'success', 'error', 'canceled', 'waiting', 'unknown'
execution_mode: 'manual', 'trigger', 'webhook', 'cron', 'unknown'
time_range: '1h', '24h', '7d', '30d', '90d', 'custom'
theme_type: 'light', 'dark', 'system'
```

## Views

### `workflow_summary`
Combines workflow and provider information for dashboard displays.

### `recent_executions`
Recent execution history with workflow and provider details.

### `provider_health`
Provider health status with aggregated statistics.

## Security (RLS Policies)

All tables have Row Level Security enabled with policies ensuring:
- Users can only access their own data (`WHERE auth.uid() = user_id`)
- Full CRUD operations are protected by user ownership
- Views inherit RLS from underlying tables

## Key Functions

### `get_dashboard_stats(user_uuid, time_range, provider_uuid)`
Returns aggregated statistics for dashboard displays:
- Total executions
- Success/failure counts
- Success rate percentage
- Average response time

### `update_workflow_stats(workflow_uuid)`
Recalculates and updates workflow statistics from execution data.
Automatically triggered when executions are added/updated/deleted.

### `cleanup_old_endpoint_results(days_to_keep)`
Maintenance function to clean up old endpoint monitoring data.

## Triggers

- **Auto-update timestamps**: `updated_at` fields are automatically maintained
- **Workflow stats updates**: When executions change, workflow statistics are recalculated
- **User preferences creation**: New users automatically get default preferences

## Indexes

Performance indexes are created on:
- User ID fields (for RLS filtering)
- Status fields (for filtering)
- Timestamp fields (for time-based queries)
- Foreign key relationships

## Usage with Supabase Auth

The schema integrates seamlessly with Supabase's built-in authentication:

1. **User Registration**: Users sign up through Supabase Auth UI
2. **Automatic Setup**: User preferences are created via trigger
3. **Data Access**: All queries are automatically filtered by `auth.uid()`
4. **API Security**: RLS ensures API endpoints can't access other users' data

## Environment Variables

The application uses these Supabase-related environment variables:

```env
NEXT_PUBLIC_SUPABASE_URL=https://***REMOVED***
NEXT_PUBLIC_SUPABASE_ANON_KEY=***REMOVED***...
SUPABASE_SERVICE_ROLE_KEY=placeholder-service-role-key  # For server-side operations
```

## Development vs Production

- **Development Mode**: `NEXT_PUBLIC_ENABLE_DEV_AUTH=true` bypasses Supabase auth
- **Production Mode**: `NEXT_PUBLIC_ENABLE_DEV_AUTH=false` uses full Supabase auth
- **Demo Data**: `NEXT_PUBLIC_ENABLE_DEMO_MODE=true` populates with sample data

## Next Steps

1. **Authentication Integration**: Update the application to use Supabase auth instead of dev mode
2. **Data Sync**: Implement provider API synchronization to populate workflows and executions
3. **Real-time Updates**: Use Supabase subscriptions for live dashboard updates
4. **Service Role**: Get and configure the service role key for server-side operations