;; scopes
;;
[(block)
 (lambda)

 ;; defs in comprehensions are limited to the
 ;; comprehension itself
 (list_comprehension)
 (dictionary_comprehension)
 (set_comprehension)
 (generator_expression)

 ;; compound statements
 (with_statement)
 (for_statement)

 (function_definition)
 ] @local.scope


;; defs

;; all assignments are counted as defs
(assignment
  left: (identifier) @local.definition.variable)

;; assignment patterns
;; a, b = 1, 2
(pattern_list
  (identifier) @local.definition.variable)

;; walrus
(named_expression
  .
  (identifier) @local.definition.variable)

;; def a()
(function_definition
  (identifier) @hoist.definition.function)

;; def _(a, b, c):
(parameters
  (identifier) @local.definition.parameter)

;; def_(a: str)
(typed_parameter
  (identifier) @local.definition.parameter)

;; lambda a, b, c: 
(lambda_parameters
  (identifier) @local.definition.parameter)

;; default params
;;
;;    def foo(printer=val):
;;
;; `printer` is a def
;; `val` is ignored
(default_parameter
  .
  (identifier) @local.definition.parameter)

;; patterns
(list_splat_pattern
  (identifier) @local.definition.variable)
(dictionary_splat_pattern
  (identifier) @local.definition.variable)
(tuple_pattern
  (identifier) @local.definition.variable)

;; with a as b:
;;
;; `b` is a def
(as_pattern
  (as_pattern_target
    (identifier) @local.definition.variable))

;; thing() for x in xs
;;
;; `x` is a def
(for_in_clause
  .
  "for"
  .
  (identifier) @local.definition.variable)

;; for a in b:
;;
;; `a` is a def
(for_statement
  .
  "for"
  .
  (identifier) @local.definition.variable)

;; imports:
;;
;;     import a, b
;;     import module.submodule.c
;;
;; here, `a`, `b`, `c` are imports, `module` and
;; `submodule` are ignored. so we capture the last
;; child of the `dotted_name` node using an anchor.
(import_statement
  (dotted_name
    (identifier) @local.import
    .))

;; import a as b
;;
;; `a` is ignored
;; `b` is an import
(import_statement
  (aliased_import
    "as"
    (identifier) @local.import))

;; from module import name1, name2
(import_from_statement
  name: 
  (dotted_name
    (identifier) @local.import))

;; from __future__ import name
(future_import_statement
  name:
  (dotted_name 
    (identifier) @local.import))

;; class A
(class_definition
  (identifier) @local.definition.class)

;; global a, b
(global_statement
  (identifier) @local.definition.variable)


;; refs

;;[a, b, c]
(list
  (identifier) @local.reference)

;; f-strings
(interpolation
  (identifier) @local.reference)

;; [ *a ]
(list_splat
  (identifier) @local.reference)

;; {a: A}
;; a is ignored
;; A is a ref
(dictionary
  (pair
    (identifier)
    (identifier) @local.reference))

;; **dict
(dictionary_splat
  (identifier) @local.reference)

;; {a, b, c}
(set
  (identifier) @local.reference)

;; a.b
;; `a` is a ref
;; `b` is ignored
(attribute
  .
  (identifier) @local.reference)

;; if we have self.field(), we can resolve field
;; safely
(attribute 
  (identifier) @_self_ident
  (identifier) @local.reference
  (#eq? @_self_ident "self"))

;; a[b]
(subscript
  (identifier) @local.reference)

;; a[i:j]
(slice
  (identifier) @local.reference)

;; a()
(call
  (identifier) @local.reference)

;; call arguments
(argument_list
  (identifier) @local.reference)

;; call(keyword=arg)
;; `keyword` is ignored
;; `arg` is a ref
(keyword_argument
  (_)
  (identifier) @local.reference)

;; (a, b, c)
(tuple 
  (identifier) @local.reference)

;; for t in item
;;
;; `item` is a reference
(for_in_clause
  "in"
  (identifier) @local.reference)

;; for a in b:
;;
;; `b` is a ref
(for_statement
  "in"
  .
  (identifier) @local.reference)

;; with a as b:
;;
;; `a` is a ref
(as_pattern
  (identifier) @local.reference)

;; (a for a in ..)
(generator_expression
  (identifier) @local.reference)

;; await x
(await
  (identifier) @local.reference)

;; return x
(return_statement
  (identifier) @local.reference)

;; a + b
(binary_operator
  (identifier) @local.reference)

;; ~a
(unary_operator
  (identifier) @local.reference)

;; a and b
(boolean_operator
  (identifier) @local.reference)

;; not a 
(not_operator
  (identifier) @local.reference)

;; a in b
;; a < b
(comparison_operator
  (identifier) @local.reference)

;; a += 1
(augmented_assignment
  (identifier) @local.reference)

;; (a)
(parenthesized_expression
  (identifier) @local.reference)

;; a, b, c
(expression_list
  (identifier) @local.reference)

;; a;
(expression_statement
  (identifier) @local.reference)

;; z if x else y
(conditional_expression
  (identifier) @local.reference)

;; comprehensions
(list_comprehension
  (identifier) @local.reference)
(dictionary_comprehension
  (pair 
    (identifier) @local.reference))
(set_comprehension
  (identifier) @local.reference)

;; decorators
(decorator
  (identifier) @local.reference)

;; type refs
;;
;; def foo(a: T)
(parameters
  (typed_parameter
    (type
      (identifier) @local.reference)))

;; def foo() -> T:
(function_definition 
  return_type: 
  (type
    (identifier) @local.reference))

;; var: T = init()
(assignment 
  type:
  (type 
    (identifier) @local.reference))

;; python 2
;;
;; print item
(print_statement
  (identifier) @local.reference)
;; print >> a
(chevron
  (identifier) @local.reference)
;; assert a, b, c
(assert_statement
  (identifier) @local.reference)
;; exec '1+1'
(exec_statement
  (identifier) @local.reference)

;; del a, b, c
(delete_statement
  (identifier) @local.reference)

(while_statement
  (identifier) @local.reference)

(if_statement
  (identifier) @local.reference)

;; raise error from e 
(raise_statement
  (identifier) @local.reference)
