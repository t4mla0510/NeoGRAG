import argparse
import logging
import sys
from pathlib import Path

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


def cmd_build_bm25(args: argparse.Namespace) -> None:
    """Execute the build-bm25 command."""
    from app.config import config
    from app.utils.bm25_indexer import BM25Indexer

    config.BM25_CACHE_DIR.mkdir(parents=True, exist_ok=True)

    bm25_indexer = BM25Indexer.get_instance()
    loaded = bm25_indexer.load_index(args.collection)

    if loaded:
        stats = bm25_indexer.get_index_stats(args.collection)
        print(f"\nBM25 index built/loaded for '{args.collection}':")
        print(f"  Documents: {stats['document_count']}")
        print(f"  Persist path: {stats['persist_path']}")
    else:
        logger.error(f"Failed to build BM25 index for collection '{args.collection}'")
        sys.exit(1)


def cmd_create_admin(args: argparse.Namespace) -> None:
    """Create an admin user."""
    from app.services.auth import create_admin

    try:
        admin = create_admin(args.email, args.password, args.username)
        print(f"\nAdmin user created successfully:")
        print(f"  ID: {admin['id']}")
        print(f"  Email: {admin['email']}")
        print(f"  Username: {admin['username']}")
    except Exception as e:
        logger.error(f"Failed to create admin: {e}")
        sys.exit(1)


def parse_headers(headers_str: str) -> list[tuple[str, str]]:
    """Parse header string like '#:H1,##:H2,###:H3' into list of tuples."""

    def parse_item(item: str) -> tuple[str, str]:
        if ":" not in item:
            raise argparse.ArgumentTypeError(
                f"Invalid header format '{item}'. Expected 'prefix:label'."
            )
        prefix, label = item.split(":", 1)
        if not prefix.strip() or not label.strip():
            raise argparse.ArgumentTypeError(
                f"Invalid header format '{item}'. Both prefix and label must be non-empty."
            )
        return prefix.strip(), label.strip()

    return [parse_item(item.strip()) for item in headers_str.split(",")]


def cmd_build_vector(args: argparse.Namespace) -> None:
    """Execute the build-vector command - vector store only."""
    from app.lib.builder import StoreBuilder

    headers = None
    if args.headers:
        headers = parse_headers(args.headers)

    builder = StoreBuilder(
        data_dir=args.data_dir,
        collection_name=args.collection,
        chunk_size=args.chunk_size,
        chunk_overlap=args.chunk_overlap,
        headers_to_split_on=headers,
        reset=args.reset,
    )

    summary = builder.build(build_bm25=False, show_progress=not args.quiet)

    if summary["files"] == 0:
        logger.warning("No files found. Nothing was ingested.")
        sys.exit(1)

    print(f"\nBuild complete:")
    print(f"  Files processed:  {summary['files']}")
    print(f"  Chunks ingested:  {summary['chunks']}")
    print(f"  Collection: {summary['collection']}")


def cmd_build(args: argparse.Namespace) -> None:
    """Execute the build command - builds both vector and BM25."""
    from app.lib.builder import StoreBuilder

    headers = None
    if args.headers:
        headers = parse_headers(args.headers)

    builder = StoreBuilder(
        data_dir=args.data_dir,
        collection_name=args.collection,
        chunk_size=args.chunk_size,
        chunk_overlap=args.chunk_overlap,
        headers_to_split_on=headers,
        reset=args.reset,
    )

    summary = builder.build(build_bm25=True, show_progress=not args.quiet)

    if summary["files"] == 0:
        logger.warning("No files found. Nothing was ingested.")
        sys.exit(1)

    print(f"\nBuild complete:")
    print(f"  Files processed:  {summary['files']}")
    print(f"  Chunks ingested:  {summary['chunks']}")
    print(f"  Collection: {summary['collection']}")
    if "bm25_index" in summary:
        print(f"  BM25 index: {summary['bm25_index']}")


def cmd_add(args: argparse.Namespace) -> None:
    """Execute the add command."""
    from app.lib.updater import CollectionUpdater

    headers = None
    if args.headers:
        headers = parse_headers(args.headers)

    updater = CollectionUpdater(
        collection_name=args.collection,
        chunk_size=args.chunk_size,
        chunk_overlap=args.chunk_overlap,
        headers_to_split_on=headers,
    )

    summary = updater.add_documents(
        args.data_dir, build_bm25=True, show_progress=not args.quiet
    )

    if summary.get("files", 0) == 0:
        logger.warning("No files found. Nothing was added.")
        sys.exit(1)

    print(f"\nAdd complete:")
    print(f"  Files processed:  {summary['files']}")
    print(f"  Chunks added:      {summary['chunks']}")
    print(f"  Collection: {summary['collection']}")
    if "bm25_index" in summary:
        print(f"  BM25 index: {summary['bm25_index']}")


def cmd_delete(args: argparse.Namespace) -> None:
    """Execute the delete command."""
    from app.lib.updater import CollectionUpdater

    updater = CollectionUpdater(collection_name=args.collection)
    result = updater.delete_collection()
    print(f"\nDeleted collection: {result['collection']}")
    print(f"  BM25 index deleted: {result['bm25_index_deleted']}")


def cmd_build_graphrag(args: argparse.Namespace) -> None:
    """Execute build-kg command."""
    from app.lib.graphrag_builder import GraphRAGBuilder
    from app.lib.graphrag_visualizer import GraphRAGVisualizer

    print(
        f"Starting GraphRAG build: data_dir={args.data_dir}, "
        f"collection={args.collection}, reset={args.reset}, workers={args.workers}"
    )
    builder = GraphRAGBuilder(
        data_dir=args.data_dir,
        collection_name=args.collection,
        chunk_size=args.chunk_size,
        chunk_overlap=args.chunk_overlap,
        workers=args.workers,
        ontology_mode=args.ontology_mode,
        ontology_path=args.ontology_path,
        ontology_sample_chars=args.ontology_sample_chars,
    )
    result = builder.build(reset=args.reset, show_progress=not args.quiet)
    json_path = result.get("json_path", "")
    html_path = ""
    if json_path:
        html_path = str(Path(json_path).with_suffix(".html"))
        GraphRAGVisualizer.render_html(
            graph_json_path=json_path,
            output_html_path=html_path,
            title=f"Đồ thị tri thức - Quy chế học vụ CTU",
        )

    print("\nGraphRAG build complete:")
    print(f"  Files processed: {result['files']}")
    print(f"  Files extracted: {result.get('processed_files', result['files'])}")
    print(f"  Files skipped (cache): {result.get('skipped_files', 0)}")
    print(f"  Chunks processed: {result['chunks']}")
    print(f"  Nodes: {result['nodes']}")
    print(f"  Edges: {result['edges']}")
    print(f"  Communities: {result.get('communities', 0)}")
    print(f"  JSON: {result.get('json_path', '')}")
    print(f"  GPickle: {result.get('gpickle_path', '')}")
    print(f"  HTML: {html_path}")
    print(f"  Cache: {result.get('cache_path', '')}")
    print(f"  Ontology: {result.get('ontology_path', '')}")


def cmd_update_graphrag(args: argparse.Namespace) -> None:
    """Execute update-graphrag command."""
    from app.lib.graphrag_builder import GraphRAGBuilder

    print(
        f"Starting GraphRAG update: data_dir={args.data_dir}, "
        f"collection={args.collection}, workers={args.workers}"
    )
    builder = GraphRAGBuilder(
        data_dir=args.data_dir,
        collection_name=args.collection,
        chunk_size=args.chunk_size,
        chunk_overlap=args.chunk_overlap,
        workers=args.workers,
        ontology_mode=args.ontology_mode,
        ontology_path=args.ontology_path,
        ontology_sample_chars=args.ontology_sample_chars,
    )
    result = builder.build(reset=False, show_progress=not args.quiet)
    print("\nGraphRAG update complete:")
    print(f"  Files processed: {result['files']}")
    print(f"  Files extracted: {result.get('processed_files', result['files'])}")
    print(f"  Files skipped (cache): {result.get('skipped_files', 0)}")
    print(f"  Chunks processed: {result['chunks']}")
    print(f"  Nodes: {result['nodes']}")
    print(f"  Edges: {result['edges']}")
    print(f"  Communities: {result.get('communities', 0)}")
    print(f"  JSON: {result.get('json_path', '')}")
    print(f"  GPickle: {result.get('gpickle_path', '')}")
    print(f"  Cache: {result.get('cache_path', '')}")
    print(f"  Ontology: {result.get('ontology_path', '')}")


def cmd_export_graphrag_html(args: argparse.Namespace) -> None:
    """Render GraphRAG JSON export into interactive HTML."""
    from app.lib.graphrag_visualizer import GraphRAGVisualizer

    out = GraphRAGVisualizer.render_html(
        graph_json_path=args.graph_json,
        output_html_path=args.output,
        title=args.title,
    )
    print("\nGraphRAG HTML export complete:")
    print(f"  Input JSON: {args.graph_json}")
    print(f"  Output HTML: {out}")


def cmd_relabel_kg_communities(args: argparse.Namespace) -> None:
    """Relabel an existing KG into the fixed academic domain communities."""
    import pickle

    from app.config import config
    from app.lib.graphrag_builder import GraphRAGBuilder
    from app.lib.graphrag_visualizer import GraphRAGVisualizer

    gpickle_path = Path(args.graph_path) if args.graph_path else (
        config.GRAPHRAG_DIR / f"{args.collection}.gpickle"
    )
    if not gpickle_path.exists():
        logger.error("Graph file not found: %s", gpickle_path)
        sys.exit(1)

    builder = GraphRAGBuilder(
        data_dir=args.data_dir,
        collection_name=args.collection,
        ontology_mode="reuse",
    )
    builder.gpickle_path = gpickle_path
    builder.json_path = Path(args.output_json) if args.output_json else (
        gpickle_path.with_suffix(".graph.json")
    )

    with open(gpickle_path, "rb") as handle:
        graph = pickle.load(handle)

    community_count = builder._annotate_communities(graph)  # noqa: SLF001
    builder._persist_graph(graph)  # noqa: SLF001

    html_path = Path(args.output_html) if args.output_html else builder.json_path.with_suffix(".html")
    GraphRAGVisualizer.render_html(
        graph_json_path=builder.json_path,
        output_html_path=html_path,
        title=f"Knowledge Graph - {args.collection}",
    )

    print("\nKG community relabel complete:")
    print(f"  Graph: {gpickle_path}")
    print(f"  Nodes: {graph.number_of_nodes()}")
    print(f"  Edges: {graph.number_of_edges()}")
    print(f"  Domain communities used: {community_count}")
    print(f"  JSON: {builder.json_path}")
    print(f"  HTML: {html_path}")


def main() -> None:
    parser = argparse.ArgumentParser(
        prog="python -m app.cli",
        description="CTU AI Context Search - Vector Store CLI",
    )
    subparsers = parser.add_subparsers(dest="command")

    build_parser = subparsers.add_parser(
        "build", help="Build vector and BM25 index for a collection"
    )
    build_parser.add_argument(
        "--data-dir",
        required=True,
        help="Path to folder containing .md files (searched recursively).",
    )
    build_parser.add_argument(
        "--collection",
        required=True,
        help="Collection name.",
    )
    build_parser.add_argument(
        "--chunk-size",
        type=int,
        default=None,
        help="Chunk size for text splitting (default: 1000).",
    )
    build_parser.add_argument(
        "--chunk-overlap",
        type=int,
        default=None,
        help="Chunk overlap for text splitting (default: 100).",
    )
    build_parser.add_argument(
        "--headers",
        default=None,
        help='Markdown headers to split on, e.g. "#:H1,##:H2,###:H3".',
    )
    build_parser.add_argument(
        "--reset",
        action="store_true",
        help="Delete existing collections before rebuilding.",
    )
    build_parser.add_argument(
        "--quiet",
        action="store_true",
        help="Suppress progress bar output.",
    )
    build_parser.set_defaults(func=cmd_build)

    build_bm25_parser = subparsers.add_parser(
        "build-bm25",
        help="Build BM25 index for a collection from ChromaDB data",
    )
    build_bm25_parser.add_argument(
        "--collection",
        default="academic_regulation",
        help="Collection name (default: academic_regulation).",
    )
    build_bm25_parser.add_argument(
        "--quiet",
        action="store_true",
        help="Suppress progress output.",
    )
    build_bm25_parser.set_defaults(func=cmd_build_bm25)

    create_admin_parser = subparsers.add_parser(
        "create-admin",
        help="Create an admin user",
    )
    create_admin_parser.add_argument(
        "--email",
        required=True,
        help="Admin email address",
    )
    create_admin_parser.add_argument(
        "--password",
        required=True,
        help="Admin password",
    )
    create_admin_parser.add_argument(
        "--username",
        required=True,
        help="Admin username",
    )
    create_admin_parser.set_defaults(func=cmd_create_admin)

    build_vector_parser = subparsers.add_parser(
        "build-vector", help="Build vector store from markdown files"
    )
    build_vector_parser.add_argument(
        "--data-dir",
        required=True,
        help="Path to folder containing .md files (searched recursively).",
    )
    build_vector_parser.add_argument(
        "--collection",
        required=True,
        help="Collection name for the vector store.",
    )
    build_vector_parser.add_argument(
        "--chunk-size",
        type=int,
        default=None,
        help="Chunk size for text splitting (default: 1000).",
    )
    build_vector_parser.add_argument(
        "--chunk-overlap",
        type=int,
        default=None,
        help="Chunk overlap for text splitting (default: 100).",
    )
    build_vector_parser.add_argument(
        "--headers",
        default=None,
        help='Markdown headers to split on, e.g. "#:H1,##:H2,###:H3".',
    )
    build_vector_parser.add_argument(
        "--reset",
        action="store_true",
        help="Delete existing collections before rebuilding.",
    )
    build_vector_parser.add_argument(
        "--quiet",
        action="store_true",
        help="Suppress progress bar output.",
    )
    build_vector_parser.set_defaults(func=cmd_build_vector)

    add_parser = subparsers.add_parser(
        "add", help="Add new markdown files to an existing collection"
    )
    add_parser.add_argument(
        "--data-dir",
        required=True,
        help="Path to folder containing .md files (searched recursively).",
    )
    add_parser.add_argument(
        "--collection",
        required=True,
        help="Existing collection name to add documents to.",
    )
    add_parser.add_argument(
        "--chunk-size",
        type=int,
        default=None,
        help="Chunk size for text splitting (default: 1000).",
    )
    add_parser.add_argument(
        "--chunk-overlap",
        type=int,
        default=None,
        help="Chunk overlap for text splitting (default: 100).",
    )
    add_parser.add_argument(
        "--headers",
        default=None,
        help='Markdown headers to split on, e.g. "#:H1,##:H2,###:H3".',
    )
    add_parser.add_argument(
        "--quiet",
        action="store_true",
        help="Suppress progress bar output.",
    )
    add_parser.set_defaults(func=cmd_add)

    delete_parser = subparsers.add_parser(
        "delete",
        help="Delete a collection and its associated BM25 index",
    )
    delete_parser.add_argument(
        "--collection",
        required=True,
        help="Collection name to delete.",
    )
    delete_parser.set_defaults(func=cmd_delete)

    build_graphrag_parser = subparsers.add_parser(
        "build-kg", help="Build knowledge graph from markdown files"
    )
    build_graphrag_parser.add_argument(
        "--data-dir",
        required=True,
        help="Path to folder containing .md files (searched recursively).",
    )
    build_graphrag_parser.add_argument(
        "--collection",
        default="academic_regulation",
        help="Graph collection name (default: academic_regulation).",
    )
    build_graphrag_parser.add_argument(
        "--chunk-size",
        type=int,
        default=None,
        help="Chunk size for text splitting (default: 1000).",
    )
    build_graphrag_parser.add_argument(
        "--chunk-overlap",
        type=int,
        default=None,
        help="Chunk overlap for text splitting (default: 100).",
    )
    build_graphrag_parser.add_argument(
        "--workers",
        type=int,
        default=1,
        help="Number of worker threads (default: 1).",
    )
    build_graphrag_parser.add_argument(
        "--reset",
        action="store_true",
        help="Reset graph before building.",
    )
    build_graphrag_parser.add_argument(
        "--ontology-mode",
        default="auto",
        choices=["auto", "reuse", "static"],
        help="Ontology mode (default: auto).",
    )
    build_graphrag_parser.add_argument(
        "--ontology-path",
        default=None,
        help="Path to ontology JSON file.",
    )
    build_graphrag_parser.add_argument(
        "--ontology-sample-chars",
        type=int,
        default=50000,
        help="Characters to sample for ontology generation (default: 50000).",
    )
    build_graphrag_parser.add_argument(
        "--quiet",
        action="store_true",
        help="Suppress progress bar output.",
    )
    build_graphrag_parser.set_defaults(func=cmd_build_graphrag)

    update_graphrag_parser = subparsers.add_parser(
        "update-kg", help="Incrementally update knowledge graph"
    )
    update_graphrag_parser.add_argument(
        "--data-dir",
        required=True,
        help="Path to folder containing .md files (searched recursively).",
    )
    update_graphrag_parser.add_argument(
        "--collection",
        default="academic_regulation",
        help="Graph collection name (default: academic_regulation).",
    )
    update_graphrag_parser.add_argument(
        "--chunk-size",
        type=int,
        default=None,
        help="Chunk size for text splitting (default: 1000).",
    )
    update_graphrag_parser.add_argument(
        "--chunk-overlap",
        type=int,
        default=None,
        help="Chunk overlap for text splitting (default: 100).",
    )
    update_graphrag_parser.add_argument(
        "--workers",
        type=int,
        default=1,
        help="Number of worker threads (default: 1).",
    )
    update_graphrag_parser.add_argument(
        "--ontology-mode",
        default="reuse",
        choices=["auto", "reuse", "static"],
        help="Ontology mode (default: reuse).",
    )
    update_graphrag_parser.add_argument(
        "--ontology-path",
        default=None,
        help="Path to ontology JSON file.",
    )
    update_graphrag_parser.add_argument(
        "--ontology-sample-chars",
        type=int,
        default=50000,
        help="Characters to sample for ontology generation (default: 50000).",
    )
    update_graphrag_parser.add_argument(
        "--quiet",
        action="store_true",
        help="Suppress progress bar output.",
    )
    update_graphrag_parser.set_defaults(func=cmd_update_graphrag)

    export_kg_parser = subparsers.add_parser(
        "export-kg", help="Export knowledge graph to HTML"
    )
    export_kg_parser.add_argument(
        "--graph-json",
        required=True,
        help="Path to GraphRAG JSON file (node-link format).",
    )
    export_kg_parser.add_argument(
        "--output",
        required=True,
        help="Output HTML path.",
    )
    export_kg_parser.add_argument(
        "--title",
        default="Knowledge Graph",
        help="HTML page title.",
    )
    export_kg_parser.set_defaults(func=cmd_export_graphrag_html)

    relabel_kg_parser = subparsers.add_parser(
        "relabel-kg",
        help="Relabel existing KG into Dao_tao/KTX/Hoc_tap_ren_luyen/Khen_thuong_ky_luat/Chung",
    )
    relabel_kg_parser.add_argument(
        "--collection",
        default="academic_regulation",
        help="Graph collection name (default: academic_regulation).",
    )
    relabel_kg_parser.add_argument(
        "--graph-path",
        default=None,
        help="Path to existing .gpickle graph. Defaults to configured collection graph.",
    )
    relabel_kg_parser.add_argument(
        "--data-dir",
        default="data",
        help="Data directory, only used to initialize the builder (default: data).",
    )
    relabel_kg_parser.add_argument(
        "--output-json",
        default=None,
        help="Output graph JSON path. Defaults beside the .gpickle graph.",
    )
    relabel_kg_parser.add_argument(
        "--output-html",
        default=None,
        help="Output HTML path. Defaults beside the graph JSON.",
    )
    relabel_kg_parser.set_defaults(func=cmd_relabel_kg_communities)

    args = parser.parse_args()
    if not args.command:
        parser.print_help()
        sys.exit(1)

    args.func(args)


if __name__ == "__main__":
    main()
