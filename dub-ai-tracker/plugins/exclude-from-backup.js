// Expo Config Plugin: Exclude AsyncStorage database from iCloud backup
// SEC: AsyncStorage SQLite database must NOT be backed up to iCloud.
// Without this, all health data (substance use, mood, therapy, clinical)
// is included in iCloud backups in plaintext.
//
// This plugin adds an AppDelegate hook that sets NSURLIsExcludedFromBackupKey
// on the RCTAsyncLocalStorage directory after app launch.

const { withAppDelegate } = require('expo/config-plugins');

const BACKUP_EXCLUSION_CODE = `
  // SEC: Exclude AsyncStorage database from iCloud backup
  // This prevents health data from being included in iCloud/iTunes backups
  NSString *appSupportDir = NSSearchPathForDirectoriesInDomains(NSApplicationSupportDirectory, NSUserDomainMask, YES).firstObject;
  NSString *asyncStorageDir = [appSupportDir stringByAppendingPathComponent:@"RCTAsyncLocalStorage_V1"];
  NSURL *asyncStorageURL = [NSURL fileURLWithPath:asyncStorageDir];
  if ([[NSFileManager defaultManager] fileExistsAtPath:asyncStorageDir]) {
    NSError *error = nil;
    [asyncStorageURL setResourceValue:@YES forKey:NSURLIsExcludedFromBackupKey error:&error];
    if (error) {
      NSLog(@"[DUB_AI] Warning: Failed to exclude AsyncStorage from backup: %@", error);
    }
  }
`;

function withExcludeFromBackup(config) {
  return withAppDelegate(config, (config) => {
    const contents = config.modResults.contents;

    // Insert the backup exclusion code after [super application:didFinishLaunchingWithOptions:]
    if (contents.includes('didFinishLaunchingWithOptions') && !contents.includes('NSURLIsExcludedFromBackupKey')) {
      // Find the return YES line in didFinishLaunchingWithOptions
      const returnPattern = /return \[super application:application didFinishLaunchingWithOptions:launchOptions\];/;
      if (returnPattern.test(contents)) {
        config.modResults.contents = contents.replace(
          returnPattern,
          `${BACKUP_EXCLUSION_CODE}\n  return [super application:application didFinishLaunchingWithOptions:launchOptions];`
        );
      }
    }

    return config;
  });
}

module.exports = withExcludeFromBackup;
