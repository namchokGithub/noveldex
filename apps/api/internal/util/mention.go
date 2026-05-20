package util

import "regexp"

var mentionRe = regexp.MustCompile(`\[\[([^\]]+)\]\]`)

func ExtractMentions(text string) []string {
	matches := mentionRe.FindAllStringSubmatch(text, -1)
	seen := make(map[string]struct{})
	var result []string
	for _, m := range matches {
		name := m[1]
		if _, ok := seen[name]; !ok {
			seen[name] = struct{}{}
			result = append(result, name)
		}
	}
	return result
}
