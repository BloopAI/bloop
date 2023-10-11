use lazy_regex::regex;

pub fn decode(markdown: String) -> String {
    let regex = regex!(
        r"^````(\w+)\n(.*?)^````(path:[^,]*,source_start_line:[^,]*,source_end_line:[^,]*)?$"sm
    );

    regex
        .replace_all(&markdown, |caps: &regex::Captures| {
            let lang = caps.get(1).unwrap().as_str();
            let body = caps.get(2).unwrap().as_str();
            let params = match caps.get(3).map(|m| m.as_str()) {
                Some(p) => format!(",{p}"),
                None => "".to_owned(),
            };

            format!("````lang:{lang}{params}\n{body}````")
        })
        .into_owned()
}

#[cfg(test)]
mod tests {
    use super::*;
    use pretty_assertions::assert_eq;

    #[test]
    fn test_simple() {
        let input = "````rust
fn foo() -> i32 {
    123
}
````

````lang:rust,path:src/main.rs,source_start_line:1,source_end_line:3
fn bar() -> i32 {
    456
}
````";

        let expected = "````lang:rust
fn foo() -> i32 {
    123
}
````

````lang:rust,path:src/main.rs,source_start_line:1,source_end_line:3
fn bar() -> i32 {
    456
}
````";

        assert_eq!(expected, decode(input.to_owned()));
    }

    #[test]
    fn test_with_embedded_markdown() {
        let input = "Generated code, with markdown doc comments:

````rust
/**
```
assert_eq!(foo(), 123);
```
*/
fn foo() -> i32 {
    123
}
````

A sourced block:

````rust
/**
```
assert_eq!(bar(), 456);
```
*/
fn bar() -> i32 {
    456
}
````path:src/main.rs,source_start_line:1,source_end_line:8

Another paragraph.";

        let expected = "Generated code, with markdown doc comments:

````lang:rust
/**
```
assert_eq!(foo(), 123);
```
*/
fn foo() -> i32 {
    123
}
````

A sourced block:

````lang:rust,path:src/main.rs,source_start_line:1,source_end_line:8
/**
```
assert_eq!(bar(), 456);
```
*/
fn bar() -> i32 {
    456
}
````

Another paragraph.";

        assert_eq!(expected, decode(input.to_owned()));
    }
}
