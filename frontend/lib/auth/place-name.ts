/**
 * City and country names as people actually type them: "Sarajevo, BiH",
 * "Washington, D.C.", "Bosnia & Herzegovina", "Frankfurt (Oder)", "Paris 15",
 * "Côte d’Ivoire". Starts with a letter or digit and holds at least one letter;
 * anything that could be markup or a script is still refused.
 */
export const placeNamePattern = /^(?=.*[\p{L}])[\p{L}\p{M}\d][\p{L}\p{M}\d'’`.,&()/ -]*$/u;

export const PLACE_NAME_MIN_LENGTH = 2;
export const PLACE_NAME_MAX_LENGTH = 85;

export function placeNameMessage(label: string) {
	return `${label} can only contain letters, numbers, spaces and . , ' - & ( ) /`;
}
