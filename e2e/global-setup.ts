import { resetSinkWithRetry } from './helpers/sink';

/** Each browser project shares one functions process, so reset the sink per project. */
export default async function globalSetup(): Promise<void> {
  await resetSinkWithRetry();
}
