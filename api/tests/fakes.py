from __future__ import annotations

from anthropic.types import Message, TextBlock, ToolUseBlock, Usage

from app.sql.execute import QueryResult


class FakeClient:
    def __init__(self, *replies):
        self.replies = list(replies)
        self.requests = []
        self.messages = self

    def create(self, **request):
        self.requests.append(request)
        assert self.replies, "the model was called more times than the test scripted"
        reply = self.replies.pop(0)

        if isinstance(reply, Exception):
            raise reply

        return reply


class FakeRunner:
    def __init__(self, *results):
        self.results = list(results)
        self.sql = []

    def run(self, sql):
        self.sql.append(sql)
        assert self.results, "the database was called more times than the test scripted"
        result = self.results.pop(0)

        if isinstance(result, Exception):
            raise result

        return result


def reply(*blocks, stop_reason=None, usage=None, stop_details=None):
    if stop_reason is None:
        stop_reason = "tool_use" if any(b.type == "tool_use" for b in blocks) else "end_turn"

    return Message(
        id="msg_1",
        type="message",
        role="assistant",
        model="claude-opus-5-5",
        content=list(blocks),
        stop_reason=stop_reason,
        stop_details=stop_details,
        stop_sequence=None,
        usage=usage or Usage(input_tokens=100, output_tokens=20),
    )


def run_sql(sql, purpose="count orders", id="toolu_1"):
    return ToolUseBlock(
        type="tool_use", id=id, name="run_sql", input={"purpose": purpose, "sql": sql}
    )


def decline(reason, id="toolu_1"):
    return ToolUseBlock(type="tool_use", id=id, name="decline", input={"reason": reason})


def text(s):
    return TextBlock(type="text", text=s)


def rows(*values, columns=("n",)):
    return QueryResult(list(columns), [list(v) for v in values])
