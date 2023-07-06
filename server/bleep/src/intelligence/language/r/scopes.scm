;; scopes
[(brace_list)
 (function_definition)
 (for)] @local.scope

;; defs

;; lhs of assignment
(left_assignment
  .
  (identifier) @local.definition.variable)
(right_assignment
  (identifier) @local.definition.variable
  .)
(super_assignment
  .
  (identifier) @local.definition.variable)
(super_right_assignment
  (identifier) @local.definition.variable
  .)

(for
  .
  (identifier) @local.definition.variable)

(formal_parameters
  (identifier) @local.definition.variable)

;; refs

;; rhs of assignment
(left_assignment
  (identifier) @local.reference
  .)
(right_assignment
  .
  (identifier) @local.reference)
(super_assignment
  (identifier) @local.reference
  .)
(super_right_assignment
  .
  (identifier) @local.reference)

(call
  (identifier) @local.reference @_call_name
  (#not-eq? @_call_name "c")) ;; used to refer to vector inits, probably noisy

(namespace_get
  .
  (identifier) @local.reference)

(binary
  (identifier) @local.reference)

(dollar
  .
  (identifier) @local.reference)

(subset
  (identifier) @local.reference)

(subset2
  (identifier) @local.reference)

;; TODO: this matches both a and b in foo(a = b)
;; the grammar does not create a new structure for named arguments
(arguments
  (identifier) @local.reference)

(if 
  (identifier) @local.reference)

(repeat
  (identifier) @local.reference)

(while
  (identifier) @local.reference)

(for
  "in"
  (identifier) @local.reference)

(switch 
  (identifier) @local.reference)

(brace_list
  (identifier) @local.reference)

(function_definition
  (identifier) @local.reference)
