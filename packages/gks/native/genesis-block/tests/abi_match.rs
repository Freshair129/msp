use genesis_block_native::*;

#[test]
fn test_abi_surface() {
    // This test ensures that the types and structs expected by the NAPI-RS 
    // generator are present and correctly shaped.
    
    let _node = NodeInput {
        id: Some("id".to_string()),
        labels: vec!["Label".to_string()],
        props: None,
    };
    
    let _edge = EdgeInput {
        id: None,
        from: "a".to_string(),
        to: "b".to_string(),
        rel: "R".to_string(),
        props: None,
        valid_from: None,
        supersede: None,
    };
    
    let _query = QueryInput {
        from: None,
        to: None,
        rel: None,
        as_of: None,
        include_invalid: None,
        limit: None,
    };
    
    assert_eq!(SCHEMA_VERSION, 1);
}
