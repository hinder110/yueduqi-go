package parser

var registry = map[string]Parser{}

func Register(name string, p Parser) {
	registry[name] = p
}

func Get(name string) Parser {
	return registry[name]
}
