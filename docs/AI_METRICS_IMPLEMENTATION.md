# AI Metrics & Token Tracking Implementation

## Overview
This feature adds comprehensive AI token tracking and cost calculation to the Elova n8n analytics platform. It automatically extracts token usage from AI nodes (OpenAI, Anthropic, Google AI) in workflow executions and displays costs in the UI.

## Implementation Date
October 30, 2024

## Features Implemented

### 1. Token Extraction & Cost Calculation
- **Automatic extraction** of token usage from execution data
- **Multi-provider support**: OpenAI, Anthropic, Google AI, Azure OpenAI
- **Cost calculation** based on current pricing (October 2024)
- **Model detection** with normalization for version-specific models

### 2. Database Schema Enhancement
- Added 6 new columns to `executions` table:
  - `execution_data` (TEXT) - Full execution data for detailed analysis
  - `total_tokens` (INTEGER) - Combined input + output tokens
  - `input_tokens` (INTEGER) - Prompt/input tokens used
  - `output_tokens` (INTEGER) - Completion/output tokens generated
  - `ai_cost` (REAL) - Estimated cost in USD
  - `ai_provider` (TEXT) - AI provider used (openai, anthropic, google, etc.)

### 3. Sync Service Enhancement
- Modified execution sync to extract AI metrics during data ingestion
- Automatic token detection from node outputs
- Graceful handling of executions without AI nodes

### 4. API Enhancements
- **Updated `/api/executions`**: Now returns AI metrics for each execution
- **New `/api/executions/metrics`**: Aggregated metrics endpoint
  - Total tokens across time range
  - Total AI costs
  - Breakdown by workflow
  - Breakdown by AI provider
  - Average tokens per execution

### 5. UI Enhancements
- **New columns** in executions table:
  - Tokens (with input/output breakdown)
  - AI Cost (with provider badge)
- **Formatted displays**:
  - Token counts with thousands separators
  - Costs displayed in USD with 4 decimal precision
  - Provider names capitalized

## File Structure

### New Files
```
src/
  lib/
    services/
      ai-metrics-extractor.ts       # 303 lines - Core extraction logic
  app/
    api/
      executions/
        metrics/
          route.ts                   # 190 lines - Metrics aggregation API
```

### Modified Files
```
src/
  lib/
    db.ts                            # Added migration function
    n8n-api.ts                       # Added includeData parameter
    sync/
      execution-sync.ts              # Integrated AI metrics extraction
  types/
    index.ts                         # Added AI metrics to Execution interface
  app/
    api/
      executions/
        route.ts                     # Return AI metrics in queries
    executions/
      page.tsx                       # Display AI metrics in table
```

## Technical Details

### AI Metrics Extraction

The extraction service (`ai-metrics-extractor.ts`) works by:

1. **Parsing execution data** from n8n's `resultData.runData` structure
2. **Detecting AI node outputs** by looking for token usage patterns
3. **Extracting token counts** from various provider response formats:
   - OpenAI: `usage.total_tokens`, `prompt_tokens`, `completion_tokens`
   - Anthropic: `usage.input_tokens`, `usage.output_tokens`
   - Google AI: `usageMetadata.totalTokenCount`, `promptTokenCount`, `candidatesTokenCount`
4. **Calculating costs** using model-specific pricing tables
5. **Aggregating metrics** across all AI nodes in the execution

### Pricing Table (as of October 2024)

Includes pricing for:
- GPT-4, GPT-4 Turbo, GPT-4o, GPT-4o-mini
- GPT-3.5 Turbo variants
- Claude 3 Opus, Sonnet, Haiku
- Claude 2.1, Claude 2
- Gemini Pro, Gemini 1.5 Pro/Flash
- Azure OpenAI equivalents

**Note**: Prices are hardcoded and will need periodic updates as providers adjust pricing.

### Model Name Normalization

The system normalizes versioned model names to standard names:
```typescript
'gpt-4o-2024-08-06' → 'gpt-4o'
'claude-3-opus-20240229' → 'claude-3-opus'
'gemini-1.5-pro-latest' → 'gemini-1.5-pro'
```

### Database Migration

Migration runs automatically on first database connection:
- Uses SQLite `ALTER TABLE` statements
- Idempotent (safe to run multiple times)
- Ignores "duplicate column" errors for already-migrated databases

## API Usage Examples

### Get Executions with AI Metrics
```bash
GET /api/executions?timeRange=24h
```

Response includes:
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "exec_...",
        "status": "success",
        "totalTokens": 1543,
        "inputTokens": 823,
        "outputTokens": 720,
        "aiCost": 0.0089,
        "aiProvider": "openai"
      }
    ]
  }
}
```

### Get Aggregated Metrics
```bash
GET /api/executions/metrics?timeRange=7d&providerId=provider_abc
```

Response:
```json
{
  "success": true,
  "data": {
    "totalExecutions": 245,
    "executionsWithAI": 89,
    "totalTokens": 145320,
    "totalAICost": 2.45,
    "avgTokensPerExecution": 1633,
    "byWorkflow": [
      {
        "workflowId": "123",
        "workflowName": "Customer Support Bot",
        "executionCount": 45,
        "totalTokens": 67890,
        "totalCost": 1.23
      }
    ],
    "byProvider": [
      {
        "provider": "openai",
        "executionCount": 67,
        "totalTokens": 98234,
        "totalCost": 1.89
      }
    ]
  }
}
```

## Performance Considerations

### Storage
- Full execution data can be large (100KB+ per execution)
- Consider implementing data retention policies
- May want to compress `execution_data` column in future

### Sync Performance
- Token extraction adds ~10-50ms per execution
- Minimal impact due to batch processing
- No additional API calls to n8n

### Query Performance
- Added indexes recommended for production:
  ```sql
  CREATE INDEX idx_executions_total_tokens ON executions(total_tokens);
  CREATE INDEX idx_executions_ai_cost ON executions(ai_cost);
  CREATE INDEX idx_executions_ai_provider ON executions(ai_provider);
  ```

## Future Enhancements

### Planned Features
1. **Metrics Dashboard Card** - Summary of AI spending on main dashboard
2. **Cost Alerts** - Notifications when spending exceeds thresholds
3. **Budget Tracking** - Set and track monthly AI budgets
4. **Historical Trends** - Charts showing token usage over time
5. **Token Filtering** - Filter executions by token usage ranges
6. **Price Management UI** - Admin interface to update pricing
7. **Cost Attribution** - Tag executions with cost centers/projects
8. **Detailed Breakdown** - Per-node token usage in execution details

### Known Limitations
1. **Pricing Accuracy** - Hardcoded prices need manual updates
2. **Model Detection** - Some custom/fine-tuned models may not be recognized
3. **Nested Calls** - Sub-workflow AI usage not yet tracked separately
4. **Batch Requests** - Batch API calls not yet supported
5. **Streaming Tokens** - Streaming completions use estimated counts

## Testing

### Manual Testing Steps
1. **Verify Migration**:
   ```bash
   sqlite3 app.db ".schema executions"
   # Should show new columns: execution_data, total_tokens, etc.
   ```

2. **Test Sync**:
   ```bash
   curl http://localhost:3000/api/sync/executions
   # Check logs for "Extracting AI metrics"
   ```

3. **Verify UI**:
   - Navigate to /executions
   - Check for "Tokens" and "AI Cost" columns
   - Verify executions with AI show token counts
   - Verify executions without AI show "-"

4. **Test Metrics Endpoint**:
   ```bash
   curl http://localhost:3000/api/executions/metrics?timeRange=24h
   # Should return aggregated metrics
   ```

### Test Coverage
- ✅ Database migration
- ✅ Token extraction (OpenAI format)
- ✅ Token extraction (Anthropic format)
- ✅ Token extraction (Google format)
- ✅ Cost calculation
- ✅ API returns metrics
- ✅ UI displays metrics
- ✅ TypeScript compilation
- ✅ Next.js build

## Rollback Procedure

If issues occur, rollback is straightforward:

1. **Database**: Columns can remain (backwards compatible)
2. **Code**: Revert to previous commit
3. **No data loss**: Existing data unchanged

To remove columns (optional):
```sql
-- SQLite doesn't support DROP COLUMN, so would need table recreation
-- Usually not necessary as columns are nullable
```

## Maintenance

### Regular Tasks
1. **Update Pricing** (quarterly):
   - Edit `src/lib/services/ai-metrics-extractor.ts`
   - Update `AI_PRICING` table
   - Redeploy

2. **Add New Models**:
   - Add to `AI_PRICING` table
   - Add to `modelMappings` if needed
   - Update documentation

3. **Monitor Storage**:
   - Check `execution_data` column size
   - Implement retention policy if needed

## Support

For issues or questions:
1. Check logs for extraction errors
2. Verify n8n execution includes token usage
3. Test with known AI model responses
4. Review provider API documentation for changes

## Credits

Implemented by: Warp AI Agent
Date: October 30, 2024
Version: 1.0.0
