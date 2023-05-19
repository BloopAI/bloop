;; scopes

[
 (block)

 ;; class items
 (class_declaration)
 (method_declaration)
 (constructor_declaration)

 ;; interface items
 (interface_declaration)
 ;; alternate syntax
 (annotation_type_declaration . "@interface")

 ;; enums
 (enum_declaration)

 ;; records
 (record_declaration)

 ;; modules
 (module_declaration)

 ;; switch
 ;;
 ;; traditional switch case block
 (switch_block_statement_group)
 ;; functional switch case block
 (switch_rule)

 ;; try-catch
 (try_with_resources_statement)
 (catch_clause)

] @local.scope


;; defs

;; int a = ..;
(variable_declarator
  name: (identifier) @local.definition.local)

;; package ident;
(package_declaration 
  (identifier) @local.definition.package)

;; module com.foo { .. }
;;
;; defines `foo` as a module
(module_declaration
  name: (identifier) @hoist.definition.module)
(module_declaration
  name: 
  (scoped_identifier
    (_)
    (identifier) @hoist.definition.module))


;; class Main { .. }
(class_declaration
  (identifier) @hoist.definition.class)

;; class Main<T, U> { .. }
(type_parameters
  (type_parameter
    (type_identifier) @local.definition.typedef))

;; methods
(method_declaration 
  name: (identifier) @hoist.definition.method)

;; constructors
(constructor_declaration 
  (identifier) @hoist.definition.method)

;; interface Iface { .. }
(interface_declaration 
  (identifier) @hoist.definition.interface)

;; alternate iface declaration syntax
;;
;; @interface Foo { .. }
(annotation_type_declaration
  "@interface" 
  (identifier) @hoist.definition.interface)

;; enums
(enum_declaration 
  name: (identifier) @hoist.definition.enum)
;; enum variants
(enum_constant
  (identifier) @local.definition.enumConstant)

;; records
(record_declaration
  name: (identifier) @hoist.definition.record)

;; for (Type item: iterator) { .. }
;; 
;; `item` is a def
(enhanced_for_statement 
  name: (identifier) @local.definition.local)

;; pattern matching creates defs
(instanceof_expression
  .
  (identifier) 
  (identifier)* @local.definition.local)

;; param list with types
(formal_parameters
  (formal_parameter 
    (identifier) @local.definition.local))
;; param list without types
(inferred_parameters
  (identifier) @local.definition.local)

;; catch declaration
(catch_formal_parameter
  (identifier) @local.definition.local)

;; try-resource declaration
(resource
  name: (identifier) @local.definition.local)

;; singluar lambda param 
;;
;; arg -> body;
(lambda_expression
  parameters: (identifier) @local.definition.local)

;; imports
;;
;; import item;
;;        ^^^^ is an import
(import_declaration 
  (identifier) @local.import)

;; import java.util.Vector;
;;                  ^^^^^^ is an import
(import_declaration 
  (scoped_identifier
    (_)
    (identifier) @local.import))

;; labels
(labeled_statement 
  (identifier) @local.definition.label)


;; refs

;; a;
(expression_statement
  (identifier) @local.reference)

;; a op b
(binary_expression 
  (identifier) @local.reference)

;; !a
(unary_expression
  (identifier) @local.reference)

;; rhs of a decl. is a ref
;;
;; int _ = b;
(variable_declarator
  value: (identifier) @local.reference)

;; a.b
(field_access
  .
  (identifier) @local.reference)

;; this.field
(field_access
  (this)
  (identifier) @local.reference)

;; a = b;
;;
;; both `a` and `b` are refs
(assignment_expression
  (identifier) @local.reference)

;; a instanceOf pattern;
;;
;; the first ident is a ref
;; subsequent idents should be defs
(instanceof_expression
  .
  (identifier) @local.reference)

;; (a)
(parenthesized_expression 
  (identifier) @local.reference)

;; a()
(method_invocation
  .
  (identifier) @local.reference)

;; this.b();
(method_invocation
  (this)
  (identifier) @local.reference)

;; class::method
(method_reference
  .
  (identifier) @local.reference)

;; _(x, y, z)
(argument_list
  (identifier) @local.reference)

;; a ? b : c
(ternary_expression 
  (identifier) @local.reference)

;; i++
(update_expression
  (identifier) @local.reference)

;; a[b]
(array_access 
  (identifier) @local.reference)

;; (T)ident;
(cast_expression
  (identifier) @local.reference)
(cast_expression
  (type_identifier) @local.reference)

;; {a, b, c}
(array_initializer
  (identifier) @local.reference)

;; new Object();
;;     ^^^^^^
(object_creation_expression 
  (type_identifier) @local.reference)
;; Foo.new Object();
;; ^^^
(object_creation_expression 
  (identifier) @local.reference)

;; for (Type item: iterator) { .. }
;;
;; `iterator` is a ref
;; `Type` is a ref
(enhanced_for_statement
  value: (identifier) @local.reference)

;; return ident;
(return_statement 
  (identifier) @local.reference)

;; assert ident;
(assert_statement
  (identifier) @local.reference)

;; break label;
(break_statement
  (identifier) @local.reference)

;; continue label;
(continue_statement
  (identifier) @local.reference)

;; yield item;
(yield_statement
  (identifier) @local.reference)

;; lambda body
(lambda_expression 
  body: (identifier) @local.reference)

;; annotations
;;
;; @Documented class C { .. }
(annotation (identifier) @local.reference)
(marker_annotation (identifier) @local.reference)

;; case-patterns
;;
;; case IDENT -> { .. }
(switch_label
  (identifier) @local.reference)

;; try-resource rhs
(resource
  value: (identifier) @local.reference)

;; uses com.foo.item;
(uses_module_directive . "uses" . (_) @local.reference)
;; requires com.foo.item;
(requires_module_directive . "requires" . (_) @local.reference)
;; exports com.foo.submodule;
(exports_module_directive . "exports" . (_) @local.reference)
;; opens com.foo.item to some, other, modules;
(opens_module_directive . "opens"
                        . (_) @local.reference)
;; provides com.foo.item with com.bar.item
(provides_module_directive . "provides" 
                           . (_) @local.reference
                           . "with"
                           . (_) @local.reference)



;; type refs

;; variable declarations with types
(local_variable_declaration 
  (type_identifier) @local.reference)

;; class field declarations with type 
(field_declaration 
  (type_identifier) @local.reference)

;; List<_, _>
(generic_type
  (type_identifier) @local.reference)

;; _<T, U, V>
;; type args in generics
(type_arguments
  (type_identifier) @local.reference)

;; wildcard type
;;
;; ? Type
(wildcard 
  (type_identifier) @local.reference)

;; String[]
(array_type
  (type_identifier) @local.reference)

;; type refs in the pattern
(instanceof_expression
  (type_identifier) @local.reference)

;; for (Type _: _) { .. }
(enhanced_for_statement
  type: (type_identifier) @local.reference)

;; <T extends Class>
(type_bound 
  (type_identifier) @local.reference)

;; class _ extends B
(superclass 
  (type_identifier) @local.reference)

;; class _ implements B
(super_interfaces
  (type_list
    (type_identifier) @local.reference))

;; interface _ extends I, J, K
(extends_interfaces 
  (type_list 
    (type_identifier) @local.reference))

;; sealed interface _ permits I, J, K
(permits 
  (type_list
    (type_identifier) @local.reference))

;; parameter types
(formal_parameter 
  (type_identifier) @local.reference)

;; type refs in method signatures
;;
;; return type
(method_declaration
  type: (type_identifier) @local.reference)
;; throws type
(method_declaration
  (throws 
    (type_identifier) @local.reference))

;; catch Type1 | Type2 exception
(catch_type 
  (type_identifier) @local.reference)

;; A.B
(scoped_type_identifier 
  .
  (type_identifier) @local.reference)

;; try-resource type
(resource
  type: (type_identifier) @local.reference)
