;; scopes
[
 (block)
 (do_block)
 (rescue)
 (when)
 (unless)
 (until)
 (begin)
 (case)
 (case_match)
 (in_clause)
 (then)
 (else)
 (method)
 (singleton_method)
 (class)
 (module)
 (lambda)
 ] @local.scope

;; defs

;; var = _
(assignment 
  left: 
    [(identifier)
     (class_variable)
     (instance_variable)] @local.definition.variable)
;; Var = _
(assignment 
  left: (constant) @local.definition.constant)
;; $var = _
(assignment 
  left: (global_variable) @global.definition.constant)
;; x, y =
(left_assignment_list
  [(identifier)
   (class_variable)
   (instance_variable)] @local.definition.variable)
;; x, y =
(left_assignment_list
  (constant) @local.definition.constant)

;; do block params
(block_parameters
  (identifier) @local.definition.variable)

;; lambda params
(lambda_parameters
  (identifier) @local.definition.variable)

;; Exception => variable
(exception_variable
  (identifier) @local.definition.variable)

;; method def
(method
  (identifier) @hoist.definition.method)

;; params
(method_parameters
  (identifier) @local.definition.variable)

;; def foo(&block)
(block_parameter
  (identifier) @local.definition.variable)

;; class def
(class
  (constant) @hoist.definition.class)

;; def foo(*list)
(splat_parameter
  (identifier) @local.definition.variable)

;; def foo(**hash)
(hash_splat_parameter
  (identifier) @local.definition.variable)

;; def foo(arg = 0)
(optional_parameter
  (identifier) @local.definition.variable)

;; module P
(module 
  (constant) @hoist.definition.module)

;; alias new_method existing_methdo
(alias 
  name: (identifier) @local.definition.method)

;; patterns
;; pat => bind
(as_pattern
  name: (identifier) @local.definition.variable)
;; Integer, a, String
(array_pattern
  (identifier) @local.definition.variable)
;; {user: u}
(hash_pattern
  (keyword_pattern
    value: (identifier) @local.definition.variable))
;; user: (only key)
(hash_pattern
  (keyword_pattern
    key: (hash_key_symbol) @local.definition.variable
    !value))
;; a | b
(alternative_pattern
  (identifier) @local.definition.variable)
;; a | b
(variable_reference_pattern
  (identifier) @local.definition.variable)


;; refs

;; a and b
(binary 
  [(identifier)
   (constant)
   (instance_variable)] @local.reference)

;; a ? b : c
(conditional
  [(identifier)
   (constant)
   (instance_variable)] @local.reference)

;; a += b
;;
;; b is a ref
(operator_assignment
  (identifier) @local.reference)

;; a..b
(range
  [(identifier)
   (constant)
   (instance_variable)] @local.reference)

;; ++a
(unary
  (identifier) @local.reference)

;; [a, b, c]
(array 
  [(identifier)
   (constant)
   (instance_variable)] @local.reference)

;; {key: v}
(pair
  [(identifier)
   (constant)
   (instance_variable)] @local.reference)


;; a = b 
;;
;; b is a ref
(assignment 
  right: 
  [(identifier)
   (constant)
   (instance_variable)] @local.reference)
(right_assignment_list
  [(identifier)
   (constant)
   (instance_variable)] @local.reference)

;; a.prop
;; a.method()
(call
  receiver:
   [(identifier)
    (constant)
    (instance_variable)] @local.reference)

;; foo()
(call
  method: (identifier) @local.reference
  !receiver)

;; method(a, b, c)
(argument_list
  [(identifier)
   (constant)
   (instance_variable)] @local.reference)

;; *arg
(splat_argument
  (identifier) @local.reference)

;; "#{var}"
(interpolation
  [(identifier)
   (constant)
   (instance_variable)] @local.reference)

;; arr[0]
(element_reference 
  [(identifier)
   (constant)
   (instance_variable)] @local.reference)

;; if _ .. elif _ .. else .. end
(if 
  [(identifier)
   (constant)
   (instance_variable)] @local.reference)
(then
  [(identifier)
   (constant)
   (instance_variable)] @local.reference)
(else 
  [(identifier)
   (constant)
   (instance_variable)] @local.reference)

;; expr if condition
(if_modifier 
  [(identifier)
   (constant)
   (instance_variable)] @local.reference)

;; while _ do _ end
(while 
  [(identifier)
   (constant)
   (instance_variable)] @local.reference)
(do
  [(identifier)
   (constant)
   (instance_variable)] @local.reference)

;; expr while condition
(while_modifier 
  [(identifier)
   (constant)
   (instance_variable)] @local.reference)

;; case a when b end
(case
  [(identifier)
   (constant)
   (instance_variable)] @local.reference)

;; begin .. rescue .. else .. ensure
(begin
  [(identifier)
   (constant)
   (instance_variable)] @local.reference)
(ensure 
  [(identifier)
   (constant)
   (instance_variable)] @local.reference)

;; unless .. end
(unless 
  [(identifier)
   (constant)
   (instance_variable)] @local.reference)

;; b unless a
(unless_modifier 
  [(identifier)
   (constant)
   (instance_variable)] @local.reference)

;; until .. end
(until 
  [(identifier)
   (constant)
   (instance_variable)] @local.reference)

;; b until a
(until_modifier 
  [(identifier)
   (constant)
   (instance_variable)] @local.reference)

;; (a)
(parenthesized_statements
  [(identifier)
   (constant)
   (instance_variable)] @local.reference)

;; statements
(body_statement 
  [(identifier)
   (constant)
   (instance_variable)] @local.reference)

(block_body 
  [(identifier)
   (constant)
   (instance_variable)] @local.reference)

;; class _ < A
(superclass 
  (constant) @local.reference)

;; alias new_method existing_methdo
(alias 
  alias: (identifier) @local.reference)

;; A::B
(scope_resolution
  scope: (constant) @local.reference)
