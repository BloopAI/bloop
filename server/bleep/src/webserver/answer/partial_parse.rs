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
        d if input.trim().starts_with(|c: char| c.is_ascii_digit()) => rectify_number(input),
        _ => panic!("malformed JSON value"),
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

    // we have just `{` close it off with `}`
    if rest.is_empty() {
        buf += "]";
    }

    // while rest.starts_with(|c: char| c.is_whitespace()) {
    //     rest = &rest[1..];
    //     buf += " ";
    // }
    rest = consume_whitespace(rest);

    while !rest.is_empty() {
        let (value, r) = rectify_json(rest);
        buf += &value;
        rest = r;

        rest = consume_whitespace(rest);

        match rest.chars().next() {
            Some(c @ ']') | Some(c @ ',') => {
                rest = &rest[1..];
                buf += &c.to_string();
                if c == ']' {
                    break;
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

    while !rest.is_empty() {
        let (value, r) = rectify_str(rest);
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
            _ => panic!("malformed JSON object"),
        }

        rest = consume_whitespace(&rest);

        let (value, r) = rectify_json(rest);
        buf += &value;
        rest = r;

        rest = consume_whitespace(&rest);

        match rest.chars().next() {
            // we can accomodate more objects
            Some(',') => {
                rest = &rest[1..];
                buf += ",";
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
    }
}
