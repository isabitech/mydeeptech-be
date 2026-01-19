
import fs from 'fs';
import util from 'util';

import('./index.js').catch(err => {
    const errorInfo = util.inspect(err, { showHidden: true, depth: null, colors: false });
    fs.writeFileSync('debug_error.txt', errorInfo + '\n' + (err.stack || ''));
    process.exit(1);
});
