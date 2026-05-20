package util

import (
	"reflect"
	"testing"
)

func TestExtractMentions(t *testing.T) {
	tests := []struct {
		name  string
		input string
		want  []string
	}{
		{"empty string", "", nil},
		{"no mentions", "plain text with no brackets", nil},
		{"one mention", "saw [[Alice]] today", []string{"Alice"}},
		{"two mentions", "[[Alice]] meets [[Bob]]", []string{"Alice", "Bob"}},
		{"duplicate deduped", "[[Alice]] and [[Alice]] again", []string{"Alice"}},
		{"adjacent", "[[Alice]][[Bob]]", []string{"Alice", "Bob"}},
		{"whitespace in name", "[[Crimson Lord]]", []string{"Crimson Lord"}},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := ExtractMentions(tc.input)
			if !reflect.DeepEqual(got, tc.want) {
				t.Errorf("ExtractMentions(%q) = %v, want %v", tc.input, got, tc.want)
			}
		})
	}
}
