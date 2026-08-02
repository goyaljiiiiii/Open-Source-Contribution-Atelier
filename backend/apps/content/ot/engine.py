from __future__ import annotations

from typing import List, Tuple

from .models import Delete, Insert, OpComponent, Operation, Retain


def apply(doc: str, op: Operation) -> str:
    result: List[str] = []
    pos = 0
    for component in op:
        if isinstance(component, Retain):
            result.append(doc[pos : pos + component.count])
            pos += component.count
        elif isinstance(component, Insert):
            result.append(component.text)
        elif isinstance(component, Delete):
            pos += component.count
    result.append(doc[pos:])
    return "".join(result)


def compose(op_a: Operation, op_b: Operation) -> Operation:
    result: Operation = []
    i = j = 0
    while i < len(op_a) and j < len(op_b):
        a = op_a[i]
        b = op_b[j]

        if isinstance(a, Retain) and isinstance(b, Retain):
            take = min(a.count, b.count)
            result.append(Retain(take))
            a = take_retain(a, take)
            b = take_retain(b, take)
            op_a[i] = a if a.count > 0 else None
            op_b[j] = b if b.count > 0 else None

        elif isinstance(a, Retain) and isinstance(b, Insert):
            result.append(b)
            op_b[j] = None

        elif isinstance(a, Retain) and isinstance(b, Delete):
            take = min(a.count, b.count)
            result.append(Delete(take))
            a = take_retain(a, take)
            op_a[i] = a if a.count > 0 else None
            b = take_delete(b, take)
            op_b[j] = b if b.count > 0 else None

        elif isinstance(a, Insert):
            result.append(a)
            op_a[i] = None

        elif isinstance(a, Delete) and isinstance(b, Retain):
            take = min(a.count, b.count)
            result.append(Delete(take))
            a = take_delete(a, take)
            op_a[i] = a if a.count > 0 else None
            b = take_retain(b, take)
            op_b[j] = b if b.count > 0 else None

        elif isinstance(a, Delete) and isinstance(b, Insert):
            result.append(b)
            op_b[j] = None

        elif isinstance(a, Delete) and isinstance(b, Delete):
            take = min(a.count, b.count)
            a = take_delete(a, take)
            op_a[i] = a if a.count > 0 else None
            b = take_delete(b, take)
            op_b[j] = b if b.count > 0 else None

        else:
            msg = f"Cannot compose {a} against {b}"
            raise ValueError(msg)

        if op_a[i] is None:
            i += 1
        if op_b[j] is None:
            j += 1

    while i < len(op_a):
        result.append(op_a[i])
        i += 1
    while j < len(op_b):
        result.append(op_b[j])
        j += 1

    return _merge(result)


def transform(op_a: Operation, op_b: Operation) -> Tuple[Operation, Operation]:
    op_a_prime: Operation = []
    op_b_prime: Operation = []
    i = j = 0

    while i < len(op_a) and j < len(op_b):
        a = op_a[i]
        b = op_b[j]

        if isinstance(a, Retain) and isinstance(b, Retain):
            take = min(a.count, b.count)
            op_a_prime.append(Retain(take))
            op_b_prime.append(Retain(take))
            a = take_retain(a, take)
            b = take_retain(b, take)
            op_a[i] = a if a.count > 0 else None
            op_b[j] = b if b.count > 0 else None

        elif isinstance(a, Retain) and isinstance(b, Insert):
            op_a_prime.append(Insert(b.text))
            op_b_prime.append(Retain(len(b.text)))
            op_b[j] = None

        elif isinstance(a, Retain) and isinstance(b, Delete):
            op_a_prime.append(Delete(take := b.count))
            op_b_prime.append(Delete(take))
            a = take_retain(a, take)
            op_a[i] = a if a.count > 0 else None
            op_b[j] = None

        elif isinstance(a, Insert):
            op_a_prime.append(Retain(len(a.text)))
            op_b_prime.append(Insert(a.text))
            op_a[i] = None

        elif isinstance(a, Delete) and isinstance(b, Retain):
            take = min(a.count, b.count)
            op_a_prime.append(Delete(take))
            op_b_prime.append(Delete(take))
            a = take_delete(a, take)
            op_a[i] = a if a.count > 0 else None
            b = take_retain(b, take)
            op_b[j] = b if b.count > 0 else None

        elif isinstance(a, Delete) and isinstance(b, Insert):
            op_a_prime.append(Insert(b.text))
            op_b_prime.append(Retain(len(b.text)))
            op_b[j] = None

        elif isinstance(a, Delete) and isinstance(b, Delete):
            take = min(a.count, b.count)
            a = take_delete(a, take)
            op_a[i] = a if a.count > 0 else None
            b = take_delete(b, take)
            op_b[j] = b if b.count > 0 else None

        else:
            msg = f"Cannot transform {a} against {b}"
            raise ValueError(msg)

        if op_a[i] is None:
            i += 1
        if op_b[j] is None:
            j += 1

    # trailing components
    while i < len(op_a):
        c = op_a[i]
        if isinstance(c, Insert):
            op_a_prime.append(Retain(len(c.text)))
            op_b_prime.append(Insert(c.text))
        elif isinstance(c, Retain):
            op_a_prime.append(Retain(c.count))
            op_b_prime.append(Delete(c.count))
        elif isinstance(c, Delete):
            op_a_prime.append(Delete(c.count))
            op_b_prime.append(Delete(c.count))
        i += 1

    while j < len(op_b):
        c = op_b[j]
        if isinstance(c, Insert):
            op_a_prime.append(Insert(c.text))
            op_b_prime.append(Retain(len(c.text)))
        elif isinstance(c, Retain):
            op_a_prime.append(Delete(c.count))
            op_b_prime.append(Retain(c.count))
        elif isinstance(c, Delete):
            op_a_prime.append(Delete(c.count))
            op_b_prime.append(Delete(c.count))
        j += 1

    return _merge(op_a_prime), _merge(op_b_prime)


def _merge(op: Operation) -> Operation:
    if not op:
        return []
    merged: Operation = []
    for c in op:
        if isinstance(c, Retain) and c.count == 0:
            continue
        if isinstance(c, Delete) and c.count == 0:
            continue
        if isinstance(c, Insert) and not c.text:
            continue
        if merged:
            prev = merged[-1]
            if isinstance(prev, Retain) and isinstance(c, Retain):
                merged[-1] = Retain(prev.count + c.count)
                continue
            if isinstance(prev, Delete) and isinstance(c, Delete):
                merged[-1] = Delete(prev.count + c.count)
                continue
            if isinstance(prev, Insert) and isinstance(c, Insert):
                merged[-1] = Insert(prev.text + c.text)
                continue
        merged.append(c)
    return merged


def take_retain(r: Retain, count: int) -> Retain:
    return Retain(r.count - count)


def take_delete(d: Delete, count: int) -> Delete:
    return Delete(d.count - count)
