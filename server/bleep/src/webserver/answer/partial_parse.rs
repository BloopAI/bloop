use std::borrow::Cow;

/// Rectify a JSON value, closing delimiters as necessary.
///
/// Returns a tuple of `(value, rest)`.
pub fn rectify_json(input: &str) -> (Cow<str>, &str) {
    if input.is_empty() {
        return ("null".into(), "");
    }

    for constant in ["true", "false", "null"] {
        if let Some(s) = input.strip_prefix(constant) {
            return (constant.into(), s);
        }
    }

    match input.chars().next().unwrap() {
        '"' => rectify_str(input),
        '[' => rectify_array(input),
        '{' => rectify_object(input),
        _d if input.trim().starts_with(|c: char| c.is_ascii_digit()) => rectify_number(input),
        c => panic!("malformed JSON value: `{c}`"),
    }
}

fn rectify_str(input: &str) -> (Cow<str>, &str) {
    let mut rest = &input[1..];
    let mut escape = false;

    // we have just `"` close it off with `"`
    if rest.is_empty() {
        return ("\"\"".into(), "");
    }

    for (len, c) in rest.chars().enumerate() {
        rest = &rest[1..];

        match c {
            '\\' => escape = !escape,
            '"' => {
                if !escape {
                    return (input[..len + 2].into(), rest);
                } else {
                    escape = false;
                }
            }
            _ => {
                if escape {
                    escape = false
                }
            }
        }
    }

    if escape {
        let s = format!("{}\"", &input[..input.len() - 1]);
        (s.into(), "")
    } else {
        ((input.to_owned() + "\"").into(), "")
    }
}

fn rectify_array(input: &str) -> (Cow<str>, &str) {
    let mut buf = String::from("[");
    let mut rest = &input[1..];

    rest = consume_whitespace(rest);

    // we have just `[` close it off with `]`
    if rest.is_empty() {
        buf += "]";
    }

    let mut continuing = false;
    while !rest.is_empty() {
        let (value, r) = rectify_json(rest);
        if continuing {
            buf.push(',');
            continuing = false;
        }
        buf += &value;
        rest = r;

        rest = consume_whitespace(rest);

        match rest.chars().next() {
            // end of this object
            Some(']') => {
                rest = &rest[1..];
                buf.push(']');
                break;
            }

            // expecting more objects ... or not
            Some(',') => {
                // we need to look further ahead:
                // - if we have more content, we may append a `,`
                // - if we cannot produce another json object, do not append `,`
                rest = &rest[1..];
                rest = consume_whitespace(rest);
                if !rest.is_empty() {
                    continuing = true;
                }
            }
            None => {}
            c => panic!("malformed JSON array: `{c:?}`"),
        }

        rest = consume_whitespace(rest);

        if rest.is_empty() {
            buf += "]";
            break;
        }
    }

    (buf.into(), rest)
}

fn rectify_number(input: &str) -> (Cow<str>, &str) {
    let mut last = None;
    let mut rest = &input[..];

    for i in 0..input.len() {
        if input[..i + 1].parse::<f64>().is_ok() {
            last = Some(&input[..i + 1]);
            rest = &rest[1..];
        } else {
            break;
        }
    }

    (last.unwrap_or("").into(), rest)
}

fn rectify_object(input: &str) -> (Cow<str>, &str) {
    let mut buf = String::from("{");
    let mut rest = &input[1..];

    rest = consume_whitespace(&rest);

    // we have just `{` close it off with `}`
    if rest.is_empty() {
        buf += "}";
    }

    let mut continuing = false;
    while !rest.is_empty() {
        let (value, r) = rectify_str(rest);
        if continuing {
            buf.push(',');
            continuing = false;
        }
        buf += &value;
        rest = r;

        rest = consume_whitespace(&rest);

        match rest.chars().next() {
            Some(':') => {
                rest = &rest[1..];
                buf += ":";
            }
            None => {
                buf += ":null}";
                break;
            }
            // beyond repair here
            c => panic!("malformed JSON object: `{c:?}`"),
        }

        rest = consume_whitespace(&rest);

        let (value, r) = rectify_json(rest);
        buf += &value;
        rest = r;

        rest = consume_whitespace(&rest);

        match rest.chars().next() {
            // expecting more objects ... or not
            Some(',') => {
                // we need to look further ahead:
                // - if we have more content, we may append a `,`
                // - if we cannot produce another json object, do not append `,`
                rest = &rest[1..];
                rest = consume_whitespace(rest);
                if !rest.is_empty() {
                    continuing = true;
                }
            }
            // end of object
            Some('}') => {
                rest = &rest[1..];
                buf += "}";
                break;
            }
            // end of stream, not much to do here
            None => {
                buf += "}";
                break;
            }
            _ => panic!("malformed JSON object"),
        }
        rest = consume_whitespace(rest);

        if rest.is_empty() {
            buf += "}";
            break;
        }
    }

    (buf.into(), rest)
}

fn consume<F: Fn(char) -> bool + Copy>(mut rest: &str, f: F) -> (String, &str) {
    let mut buf = String::new();

    while rest.starts_with(f) {
        buf.push(rest.chars().next().unwrap());
        rest = &rest[1..];
    }

    (buf, rest)
}

fn consume_whitespace(rest: &str) -> &str {
    consume(rest, |c| c.is_whitespace()).1
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_rectify_string() {
        let (value, rest) = rectify_json("\"\"");
        assert_eq!(value, "\"\"");
        assert_eq!(rest, "");

        let (value, rest) = rectify_json("\"");
        assert_eq!(value, "\"\"");
        assert_eq!(rest, "");

        let (value, rest) = rectify_json("\"abc");
        assert_eq!(value, "\"abc\"");
        assert_eq!(rest, "");

        let (value, rest) = rectify_json("\"abc\\");
        assert_eq!(value, "\"abc\"");
        assert_eq!(rest, "");

        let (value, rest) = rectify_json("\"abc\\\"");
        assert_eq!(value, "\"abc\\\"\"");
        assert_eq!(rest, "");

        let (value, rest) = rectify_json("\"abc\"foo");
        assert_eq!(value, "\"abc\"");
        assert_eq!(rest, "foo");
    }

    #[test]
    fn test_rectify_array() {
        let (value, rest) = rectify_json(r#"["foo", "bar","baaz"   ,  "fred" ]foo"#);
        assert_eq!(value, r#"["foo","bar","baaz","fred"]"#);
        assert_eq!(rest, "foo");

        let (value, rest) = rectify_json(r#"["foo", "bar","baaz"   ,  "fred""#);
        assert_eq!(value, r#"["foo","bar","baaz","fred"]"#);
        assert_eq!(rest, "");

        let (value, rest) = rectify_json(r#"["cite",1"#);
        assert_eq!(value, r#"["cite",1]"#);
        assert_eq!(rest, "");

        let (value, rest) = rectify_json("[[\"cite\",1],\n");
        assert_eq!(value, "[[\"cite\",1]]");
        assert_eq!(rest, "");

        let (value, rest) = rectify_json("[[\"cite\",1],\n[");
        assert_eq!(value, "[[\"cite\",1],[]]");
        assert_eq!(rest, "");

        let (value, rest) = rectify_json("[[\"cite\",1],\n[\"");
        assert_eq!(value, "[[\"cite\",1],[\"\"]]");
        assert_eq!(rest, "");

        let (value, rest) = rectify_json("[[\"cite\",1],\n[\"cite\",");
        assert_eq!(value, "[[\"cite\",1],[\"cite\"]]");
        assert_eq!(rest, "");
    }

    #[test]
    fn test_rectify_number() {
        let (value, rest) = rectify_json("123");
        assert_eq!(value, "123");
        assert_eq!(rest, "");

        let (value, rest) = rectify_json("123.4");
        assert_eq!(value, "123.4");
        assert_eq!(rest, "");

        let (value, rest) = rectify_json("1, \"");
        assert_eq!(value, "1");
        assert_eq!(rest, ", \"");
    }

    #[test]
    fn test_rectify_object() {
        let (value, rest) = rectify_json(r#"{"foo":"bar"}"#);
        assert_eq!(value, r#"{"foo":"bar"}"#);
        assert_eq!(rest, "");

        let (value, rest) = rectify_json(r#"{"foo":"bar""#);
        assert_eq!(value, r#"{"foo":"bar"}"#);
        assert_eq!(rest, "");

        let (value, rest) = rectify_json(r#"{"foo":"bar"#);
        assert_eq!(value, r#"{"foo":"bar"}"#);
        assert_eq!(rest, "");

        let (value, rest) = rectify_json(r#"{"foo":""#);
        assert_eq!(value, r#"{"foo":""}"#);
        assert_eq!(rest, "");

        let (value, rest) = rectify_json(r#"{"foo":"#);
        assert_eq!(value, r#"{"foo":null}"#);
        assert_eq!(rest, "");

        let (value, rest) = rectify_json(r#"{"foo""#);
        assert_eq!(value, r#"{"foo":null}"#);
        assert_eq!(rest, "");

        let (value, rest) = rectify_json(r#"{"fo""#);
        assert_eq!(value, r#"{"fo":null}"#);
        assert_eq!(rest, "");

        let (value, rest) = rectify_json(r#"{"#);
        assert_eq!(value, r#"{}"#);
        assert_eq!(rest, "");

        let (value, rest) = rectify_json(r#"{"foo": {"bar": "baz"}"#);
        assert_eq!(value, r#"{"foo":{"bar":"baz"}}"#);
        assert_eq!(rest, "");

        let (value, rest) = rectify_json(r#"{"foo": ["hello"#);
        assert_eq!(value, r#"{"foo":["hello"]}"#);
        assert_eq!(rest, "");

        let (value, rest) = rectify_json(r#"{"foo": {"bar""#);
        assert_eq!(value, r#"{"foo":{"bar":null}}"#);
        assert_eq!(rest, "");

        let (value, rest) = rectify_json("{\"oldFileName\": \"config.rs\",\n\"new\"");
        assert_eq!(value, "{\"oldFileName\":\"config.rs\",\"new\":null}");
        assert_eq!(rest, "");

        let (value, rest) = rectify_json("[{\"oldFileName\": \"config.rs\",\n\"ne");
        assert_eq!(value, "[{\"oldFileName\":\"config.rs\",\"ne\":null}]");
        assert_eq!(rest, "");

        let (value, rest) = rectify_json("[{\"oldFileName\": \"config.rs\",\n\"new\":null,");
        assert_eq!(value, "[{\"oldFileName\":\"config.rs\",\"new\":null}]");
        assert_eq!(rest, "");
    }
}
