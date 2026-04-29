#!/bin/bash
# Test script to simulate cron environment
cd /Users/mandate/projects/mydeeptech-be
export PATH=/usr/bin:/bin:/usr/local/bin
/usr/bin/node scripts/processExpiredApplications.js >> logs/expiry-test-$(date +%Y%m%d-%H%M).log 2>&1
