;; scopes

[
  (statement_block)
  (class_body)
  (arrow_function)
  (object)
  ;; nameless functions create scopes, just like arrow functions
  (function !name)
  (function_declaration)
  (method_definition)
  (generator_function_declaration)
  (for_statement)
  (for_in_statement)
  (switch_case)
  (catch_clause)
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

;; {x: y}
(pair_pattern
  (property_identifier)
  (identifier) @local.definition.variable)

;; var x = _
;; var [x, y] = _
;; var {x, y} = _
(variable_declaration
  (variable_declarator . (identifier) @local.definition.variable))
(variable_declaration
  (variable_declarator 
    name: (array_pattern
            (identifier) @local.definition.variable)))
(variable_declaration
  (variable_declarator 
    name: (object_pattern
            (shorthand_property_identifier_pattern) @local.definition.variable)))

;; const _ = require(_) should produce imports
(
 (lexical_declaration
   ["const" "let"]
   (variable_declarator 
     name: (identifier) @local.import
     value: (call_expression 
              function: (identifier) @_req_call)))
  (#match? @_req_call "require")
 )

;; const _ = anything_else should produce const defs
;; let _ = anything_else should produce var defs
(
 (lexical_declaration
   "const"
   (variable_declarator 
     name: (identifier) @local.definition.constant
     value: (_) @_rest))
  (#not-match? @_rest "require.*")
 )
(
 (lexical_declaration
   "let"
   (variable_declarator 
     name: (identifier) @local.definition.variable
     value: (_) @_rest))
  (#not-match? @_rest "require.*")
 )

;; perform above dance for pattern matching in const/let patterns
;; - import when
;;   * const/let with object pattern
;;   * const/let with array pattern
;; - define a const when using
;;   * const with object pattern
;;   * const with array pattern
;; - define a variable when using
;;   * let with object pattern
;;   * let with array pattern

;; case 1 (imports):
(
 (lexical_declaration
   ["const" "let"]
   (variable_declarator 
     name: 
     (object_pattern
       (shorthand_property_identifier_pattern) @local.import)
     value: (call_expression 
              function: (identifier) @_req_call)))
 (#match? @_req_call "require")
)
(
 (lexical_declaration
   ["const" "let"]
   (variable_declarator 
     name: 
      (array_pattern
        (identifier) @local.import)
     value: (call_expression 
              function: (identifier) @_req_call)))
 (#match? @_req_call "require")
)

;; case 2:
(
 (lexical_declaration
   "const"
   (variable_declarator 
     name: 
     (object_pattern
       (shorthand_property_identifier_pattern) @local.definition.constant)
     value: (_) @_rest))
  (#not-match? @_rest "require.*")
)
(
 (lexical_declaration
   "let"
   (variable_declarator 
     name: 
     (object_pattern
       (shorthand_property_identifier_pattern) @local.definition.variable)
     value: (_) @_rest))
  (#not-match? @_rest "require.*")
)

;; case 3:
(
 (lexical_declaration
   "const"
   (variable_declarator 
     name: 
      (array_pattern
        (identifier) @local.definition.constant)
     value: (_) @_rest))
  (#not-match? @_rest "require.*")
)
(
 (lexical_declaration
   "let"
   (variable_declarator 
     name: 
      (array_pattern
        (identifier) @local.definition.variable)
     value: (_) @_rest))
  (#not-match? @_rest "require.*")
)


;; a = b
(assignment_expression
  left: (identifier) @local.definition.variable)

;; method def
;;
;; TODO: support getters and setters here, blocked on:
;; https://github.com/tree-sitter/tree-sitter/issues/1461
(method_definition
  (property_identifier) @hoist.definition.method)

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

;; imports

;; import defaultMember from "module";
(import_statement
  (import_clause (identifier) @local.import))

;; import { member } from "module";
;; import { member as alias } from "module";
(import_statement
  (import_clause
    (named_imports
      [(import_specifier !alias (identifier) @local.import)
       (import_specifier alias: (identifier) @local.import)])))

;; for (item in list)
;;
;; `item` is a def
(for_in_statement 
  left: (identifier) @local.definition.variable)

;; labels
(labeled_statement
  (statement_identifier) @local.definition.label)

;; catch clauses
(catch_clause
  (identifier) @local.definition.variable)

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

;; a = b
;; `b` is a ref
(assignment_expression
  right: (identifier) @local.reference)

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

;; chass _ extends T
;; `T` is a ref
(class_heritage
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

;; template strings
(template_substitution
  (identifier) @local.reference)
