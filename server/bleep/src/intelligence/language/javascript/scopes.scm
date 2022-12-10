;; scopes

[
  (statement_block)
  (class_body)
  (arrow_function)
  (object)
  ;; nameless functions create scopes, just like arrow functions
  (function !name)
  (function_declaration)
  (generator_function_declaration)
  (for_statement)
  (for_in_statement)
  (switch_case)
  ;; assignments are permitted inside sequence exprs:
  ;;
  ;;     const a = 2;
  ;;     throw f = 1, f, a;
  ;; 
  ;; should produce:
  ;;
  ;;     {
  ;;       defs: [ a ],
  ;;       scopes [{
  ;;          defs: [ f ],
  ;;          refs: [ f, a ]
  ;;       }],
  ;;     }
  (sequence_expression)
] @local.scope



;; defs

;; tree-sitter-javascript has 5 "declaration" kinds:
;;
;; - class
;; - function
;; - generator function
;; - lexical
;; - variable

;; function x()
(function_declaration
  (identifier) @hoist.definition.function)

(generator_function_declaration
  (identifier) @hoist.definition.generator)

;; function params
(formal_parameters
  (identifier) @local.definition.variable)

;; patterns

;; f(a, ...b)
(rest_pattern
  (identifier) @local.definition.variable)

;; f(a, y = f)
;;
;; the lhs is a def, the rhs is a ref
(assignment_pattern
  (identifier) @local.definition.variable
  (identifier) @local.reference)

;; for ([a, b] in thing)
;;
;; `a` & `b` are defs
(array_pattern
  (identifier) @local.definition.variable)

;; let {a, b} = obj;
(object_pattern
  (shorthand_property_identifier_pattern) @local.definition.variable)

;; var x = _
(variable_declaration
  (variable_declarator . (identifier) @local.definition.variable))

;; const x = _
(lexical_declaration
  "const"
  (variable_declarator . (identifier) @local.definition.constant))

;; let x = _
(lexical_declaration
  "let"
  (variable_declarator . (identifier) @local.definition.variable))

;; a = b
(assignment_expression
  .
  (identifier) @local.definition.variable)

;; method def
;;
;; TODO: support getters and setters here, blocked on:
;; https://github.com/tree-sitter/tree-sitter/issues/1461
(method_definition
  (property_identifier) @local.definition.method)

;; class
(class_declaration
  (identifier) @local.definition.class)

;; class fields
(class_body
  (field_definition
    (private_property_identifier) @local.definition.property))

;; arrow func
(arrow_function
  (identifier) @local.definition.variable)

;; imports are defs, but of unknown kinds

;; import defaultMember from "module";
(import_statement
  (import_clause (identifier) @local.definition))

;; import { member } from "module";
;; import { member as alias } from "module";
(import_statement
  (import_clause
    (named_imports
      [(import_specifier !alias (identifier) @local.definition)
       (import_specifier alias: (identifier) @local.definition)])))

;; for (item in list)
;;
;; `item` is a def
(for_in_statement 
  left: (identifier) @local.definition.variable)

;; labels
(labeled_statement
  (statement_identifier) @local.definition.label)


;; refs

;; someVar;
(expression_statement (identifier) @local.reference)

;; { "a": value }
(object
  (pair
    (identifier) @local.reference))

;; y = {a, b}
(object
  (shorthand_property_identifier) @local.reference)


;; [ a, b, c ]
(array
  (identifier) @local.reference)

;; new Object()
(new_expression
  (identifier) @local.reference)

;; return x;
(return_statement 
  (identifier) @local.reference)

;; yield t;
(yield_expression
  (identifier) @local.reference)

;; call expression
(call_expression
  (identifier) @local.reference)

;; call arguments
(arguments
  (identifier) @local.reference)

;; index expression
(subscript_expression
  (identifier) @local.reference)

;; member expression
(member_expression
  (identifier) @local.reference)

;; await ident;
(await_expression 
  (identifier) @local.reference)

;; a + b
(binary_expression
  (identifier) @local.reference)

;; -x
(unary_expression
  (identifier) @local.reference)

;; x++
(update_expression
  (identifier) @local.reference)

;; a += b
(augmented_assignment_expression
  (identifier) @local.reference)

;; (a)
(parenthesized_expression
  (identifier) @local.reference)

;; tuples
(sequence_expression
  (identifier) @local.reference)

;; c? a : b
(ternary_expression
  (identifier) @local.reference)

;; {...object}
(spread_element
  (identifier) @local.reference)

;; exports are refs
;;
;; export { name, name };
;; export { name as alias };
(export_statement
  (export_clause
    (export_specifier name: (identifier) @local.reference)))

;; export default ident;
(export_statement
  (identifier) @local.reference)

;; for (item in list)
;;
;; `list` is a def
(for_in_statement 
  right: (identifier) @local.reference)

;; break f;
(break_statement (statement_identifier) @local.reference)

;; continue f;
(continue_statement (statement_identifier) @local.reference)

;; jsx
(jsx_expression
  (identifier) @local.reference)

(jsx_opening_element
  (identifier) @local.reference)

(jsx_closing_element
  (identifier) @local.reference)

(jsx_self_closing_element
  (identifier) @local.reference)
