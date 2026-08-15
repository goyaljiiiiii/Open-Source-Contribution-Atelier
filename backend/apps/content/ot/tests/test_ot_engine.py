from hypothesis import assume, given, strategies as st
from hypothesis.stateful import RuleBasedStateMachine, invariant, rule

from apps.content.ot.engine import apply, compose, transform
from apps.content.ot.models import Delete, Insert, Retain


def _op_to_str(op):
    parts = []
    for c in op:
        if isinstance(c, Retain):
            parts.append(f"R({c.count})")
        elif isinstance(c, Insert):
            parts.append(f"I({c.text!r})")
        elif isinstance(c, Delete):
            parts.append(f"D({c.count})")
    return ",".join(parts)


st_retain = st.integers(min_value=0, max_value=20).map(Retain)
st_insert = st.text(min_size=0, max_size=5).map(Insert)
st_delete = st.integers(min_value=0, max_value=20).map(Delete)
st_component = st.one_of(st_retain, st_insert, st_delete)


def doc_length(doc: str) -> int:
    return len(doc)


def op_consumes_doc(op) -> int:
    consumed = 0
    for c in op:
        if isinstance(c, Retain):
            consumed += c.count
        elif isinstance(c, Delete):
            consumed += c.count
    return consumed


def op_inserts_length(op) -> int:
    return sum(len(c.text) for c in op if isinstance(c, Insert))


def result_length(doc: str, op) -> int:
    return doc_length(doc) - op_consumes_doc(op) + op_inserts_length(op)


def valid_op_for_doc(doc: str, op) -> bool:
    # The sum of retains + deletes must not exceed doc length,
    # and any trailing retains after doc end are ok (they just extend)
    total = 0
    for c in op:
        if isinstance(c, (Retain, Delete)):
            total += c.count
    # It's ok for the op to partially consume the doc,
    # we just need to ensure it doesn't go past.
    return total <= len(doc)


@st.composite
def doc_and_op(draw):
    doc = draw(st.text(min_size=0, max_size=30))
    # Generate an operation valid for this doc
    remaining = len(doc)
    op = []
    while remaining > 0 or not op:
        if not op and remaining == 0 and draw(st.booleans()):
            op.append(draw(st_insert))
            break
        kind = draw(st.sampled_from(["retain", "insert", "delete"]))
        if kind == "retain" and remaining > 0:
            take = draw(st.integers(min_value=0, max_value=remaining))
            if take > 0:
                op.append(Retain(take))
                remaining -= take
        elif kind == "delete" and remaining > 0:
            take = draw(st.integers(min_value=0, max_value=remaining))
            if take > 0:
                op.append(Delete(take))
                remaining -= take
        elif kind == "insert":
            text = draw(st.text(min_size=0, max_size=5))
            op.append(Insert(text))
        if remaining == 0 and draw(st.booleans()):
            break
    # Maybe add a trailing Insert
    if draw(st.booleans()) and op:
        op.append(draw(st_insert))
    return doc, op


@given(doc_and_op())
def test_apply_result_length(args):
    doc, op = args
    assume(valid_op_for_doc(doc, op))
    result = apply(doc, op)
    assert len(result) == result_length(doc, op)


@given(doc_and_op())
def test_apply_identity_with_empty_inserts(args):
    doc, op = args
    assume(valid_op_for_doc(doc, op))
    # If all inserts are empty, op just removes retains/deletes
    non_empty_inserts = any(c.text for c in op if isinstance(c, Insert))
    assume(not non_empty_inserts)
    result = apply(doc, op)
    assert len(result) == len(doc) - op_consumes_doc(op)


@given(st.text(min_size=0, max_size=20))
def test_apply_empty_op(doc):
    assert apply(doc, []) == doc


@given(st.text(min_size=0, max_size=20), st.text(min_size=0, max_size=10))
def test_apply_single_insert(doc, text):
    op = [Insert(text)]
    result = apply(doc, op)
    assert result == text + doc


@given(st.text(min_size=1, max_size=20))
def test_apply_single_delete_all(doc):
    op = [Delete(len(doc))]
    assert apply(doc, op) == ""


@given(st.text(min_size=0, max_size=20), st.integers(min_value=0, max_value=20))
def test_apply_retain_then_insert(doc, pos):
    assume(pos <= len(doc))
    op = [Retain(pos), Insert("X")]
    result = apply(doc, op)
    assert result == doc[:pos] + "X" + doc[pos:]


@given(st.text(min_size=0, max_size=20), st.integers(min_value=0, max_value=20))
def test_apply_retain_then_delete(doc, pos):
    assume(pos <= len(doc))
    op = [Retain(pos), Delete(len(doc) - pos)]
    result = apply(doc, op)
    assert result == doc[:pos]


@given(doc_and_op(), doc_and_op())
def test_compose_equivalent_to_sequential_apply(args_a, args_b):
    doc, op_a = args_a
    _, op_b = args_b
    assume(valid_op_for_doc(doc, op_a))
    intermediate = apply(doc, op_a)
    assume(valid_op_for_doc(intermediate, op_b))
    composed = compose(op_a, op_b)
    assert valid_op_for_doc(doc, composed)
    assert apply(doc, composed) == apply(intermediate, op_b)


@given(doc_and_op(), doc_and_op())
def test_transform_concurrent_consistency(args_a, args_b):
    doc, op_a = args_a
    _, op_b = args_b
    assume(valid_op_for_doc(doc, op_a))
    assume(valid_op_for_doc(doc, op_b))
    op_a_prime, op_b_prime = transform(op_a, op_b)
    assert valid_op_for_doc(doc, op_a_prime)
    assert valid_op_for_doc(doc, op_b_prime)
    result_a = apply(doc, op_a_prime)
    result_b = apply(doc, op_b_prime)
    assert len(result_a) == len(result_b), (
        f"Length mismatch: a={len(result_a)} b={len(result_b)}\n"
        f"  doc={doc!r}\n"
        f"  op_a={_op_to_str(op_a)}\n"
        f"  op_b={_op_to_str(op_b)}\n"
        f"  op_a'={_op_to_str(op_a_prime)}\n"
        f"  op_b'={_op_to_str(op_b_prime)}"
    )


class OTRoundtripMachine(RuleBasedStateMachine):
    def __init__(self):
        super().__init__()
        self.doc = ""

    @rule(op=doc_and_op().map(lambda x: x[1]))
    def apply_single(self, op):
        assume(valid_op_for_doc(self.doc, op))
        self.doc = apply(self.doc, op)

    @rule(
        op_a=doc_and_op().map(lambda x: x[1]),
        op_b=doc_and_op().map(lambda x: x[1]),
    )
    def concurrent_transform(self, op_a, op_b):
        assume(valid_op_for_doc(self.doc, op_a))
        assume(valid_op_for_doc(self.doc, op_b))
        op_a_prime, op_b_prime = transform(op_a, op_b)
        doc_a = apply(self.doc, op_a_prime)
        doc_b = apply(self.doc, op_b_prime)
        assert len(doc_a) == len(doc_b), (
            f"Length mismatch after transform:\n"
            f"  doc={self.doc!r}\n"
            f"  doc_a={doc_a!r}\n"
            f"  doc_b={doc_b!r}"
        )

    @invariant()
    def doc_is_str(self):
        assert isinstance(self.doc, str)


TestOTRoundtrip = OTRoundtripMachine.TestCase
