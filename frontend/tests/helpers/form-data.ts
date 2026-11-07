/**
 * Builds a FormData the way a browser would: `string[]` values become repeated
 * entries so `formData.getAll(key)` sees each one.
 */
export function buildFormData(
	values: Record<string, string | string[] | undefined>,
) {
	const formData = new FormData();

	for (const [key, value] of Object.entries(values)) {
		if (value === undefined) {
			continue;
		}

		if (Array.isArray(value)) {
			for (const item of value) {
				formData.append(key, item);
			}

			continue;
		}

		formData.set(key, value);
	}

	return formData;
}
