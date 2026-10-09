import { getToolkitSettings, type ToolkitSettings, type UniformAuth } from './uniform';

/**
 * Server-side check for the admin "allow import" settings. Hiding the import UI
 * is not enough: a write request can be sent without the UI.
 *
 * Fails closed — when the settings cannot be read, the import is refused.
 */
export async function isImportAllowed(
  auth: UniformAuth,
  setting: keyof ToolkitSettings
): Promise<boolean> {
  try {
    const settings = await getToolkitSettings(auth);
    return settings[setting] !== false;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Could not read integration settings; refusing import', err);
    return false;
  }
}

export function importBlockedMessage(what: string): string {
  return `CSV import for the ${what} is turned off for this project, or its setting could not be read. Ask a project admin to check the Content Toolbox integration settings.`;
}
