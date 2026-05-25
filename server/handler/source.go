package handler

import "github.com/hinder110/yueduqi-go/server/parser"

func ParserForSource(source string) Parser {
	return parser.ForSource(source)
}
