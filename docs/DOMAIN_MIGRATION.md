# Domain Migration Guide

This guide explains how to migrate from the legacy `domains_of_interest` field in the `dtUser` model to the new domain-to-user relationship model.

## Migration Overview

The migration process moves user domain preferences from:

- **Before**: `dtUser.project_preferences.domains_of_interest` (array of strings)
- **After**: `DomainToUser` relationship model (normalized references)

## Migration Steps

### Step 1: Verify Current State

First, check the current state of your database:

```bash
npm run domain:verify
```

This will show:

- Current domain structure (categories, sub-categories, children)
- Users with `domains_of_interest`
- Domain distribution across users
- Existing domain mappings

### Step 2: Run Migration (Dry Run)

Perform a dry run to see what changes will be made:

```bash
npm run domain:migrate
```

This will:

- ✅ Show all affected users
- ✅ Display domain mapping strategy
- ✅ Preview what domains will be created
- ✅ Show migration plan
- ❌ **NOT make any changes** (dry run mode)

### Step 3: Execute Live Migration

Once you're satisfied with the preview:

```bash
npm run domain:migrate-live
```

⚠️ **WARNING**: This will make actual changes to your database.

## What the Migration Does

### 1. Domain Creation

- Creates a "General" category if none exists
- Maps each `DOMAIN_OPTIONS` entry to a `domain_child` record
- Reuses existing domain children if found (case-insensitive)

### 2. User Mapping

- Finds all non-admin users with `domains_of_interest`
- Creates `DomainToUser` records for each user-domain combination
- Skips existing mappings to avoid duplicates

### 3. Data Preservation

- **Does NOT delete** the original `domains_of_interest` field
- Creates new relationships without breaking existing data
- Maintains full audit trail

## Migration Output

The migration provides detailed logging:

```
🚀 Starting Domain Migration Process
Mode: DRY RUN

📋 Fetching existing domains...
   - Categories: 2
   - Sub-categories: 5
   - Domain children: 15

👥 Finding affected users...
   Found 25 users with domains_of_interest
   1. John Doe (john@example.com) - Role: USER
      Domains: Technology, Science, Coding

📊 MIGRATION PREVIEW
==================================================
📈 Summary:
   - Users to migrate: 25
   - Domain mappings: 29
   - New domains to create: 12
   - Existing domains to use: 17

👤 Users and their domain mappings:
   1. John Doe (john@example.com)
      Current domains: Technology, Science, Coding
      Will be mapped to:
        ✅ "Technology" -> 507f1f77bcf86cd799439011
        🆕 "Science" -> [NEW]
        ✅ "Coding" -> 507f1f77bcf86cd799439012
```

## Domain Options

The migration handles these legacy domain options:

```javascript
[
  "Arts and Entertainment",
  "Computing",
  "Consumer Electronics",
  "Coding",
  "Code Execution",
  "Code Interpreter",
  "Economy",
  "Education",
  "Employment",
  "Entertainment",
  "Environment",
  "Food and Drink",
  "Health",
  "History",
  "Home & Garden",
  "Information Technology",
  "Law / Legal",
  "Science",
  "Sports",
  "Technology",
  "Travel",
  "Other",
  "Adversarial Prompting",
  "Aspirational Capability",
  "STEM",
  "Finance",
  "Math",
  "Retrieval Augmented Generation (RAG)",
  "News",
  "Coding - Tool Use",
];
```

## Database Schema Changes

### Before Migration

```javascript
// dtUser model
{
  project_preferences: {
    domains_of_interest: ["Technology", "Science"]; // Array of strings
  }
}
```

### After Migration

```javascript
// dtUser model (unchanged)
{
  project_preferences: {
    domains_of_interest: ["Technology", "Science"] // Still exists
  }
}

// New DomainToUser records
{
  domain_category: ObjectId("..."),    // "General" category
  domain_child: ObjectId("..."),       // "Technology" child
  user: ObjectId("..."),              // User reference
  // ... other fields
}
```

## Safety Features

- ✅ **Dry run mode** by default
- ✅ **Confirmation prompt** before live migration
- ✅ **Duplicate detection** prevents double-mapping
- ✅ **Error handling** with detailed reporting
- ✅ **Data preservation** keeps original fields
- ✅ **Rollback friendly** (original data intact)

## Error Handling

The migration handles various error scenarios:

- Invalid domain names
- Database connection issues
- Duplicate mapping attempts
- Missing references
- User permission conflicts

All errors are logged with context for debugging.

## Rollback Strategy

If needed, you can rollback by:

1. **Deleting domain mappings**:

   ```javascript
   // Delete all mappings created during migration
   await DomainToUser.deleteMany({
     createdAt: { $gte: migrationDate },
   });
   ```

2. **Keeping original data**: The `domains_of_interest` field is preserved, so you can continue using it if needed.

## Verification Commands

After migration, verify the results:

```bash
# Check final state
npm run domain:verify

# Count mappings
node -e "
const DomainToUser = require('./models/domain-to-user-model');
DomainToUser.countDocuments().then(count => {
  console.log('Total mappings:', count);
  process.exit(0);
});
"
```

## Troubleshooting

### Common Issues

1. **"No users found"**: Ensure users have `domains_of_interest` populated
2. **"Connection failed"**: Check MongoDB URI in environment variables
3. **"Permission denied"**: Ensure database user has write permissions
4. **"Duplicate key error"**: Usually handled automatically, but check for manual data conflicts

### Environment Variables

Ensure these are set:

```bash
DATABASE_URL=mongodb://...
# OR
MONGODB_URI=mongodb://...
```

## Performance Notes

- Migration processes users in sequence (not parallel)
- Large datasets may take several minutes
- Monitor memory usage for thousands of users
- Consider running during low-traffic periods

## Support

If you encounter issues:

1. Check the migration logs for specific error messages
2. Verify database connectivity and permissions
3. Ensure all required models are properly imported
4. Run the verification script first to check current state

---

**Next Steps**: After successful migration, update your frontend code to use the new domain relationship endpoints instead of the `domains_of_interest` field.
