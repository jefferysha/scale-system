"""三种协议解析器单测。"""
from __future__ import annotations

from scale_api.serial.protocol_parser import (
    GenericParser,
    MettlerParser,
    SartoriusParser,
    make_parser,
)


class TestMettler:
    def test_stable_sample(self) -> None:
        p = MettlerParser()
        out = p.feed(b"S S 168.4521 g\r\n")
        assert len(out) == 1
        s = out[0]
        assert s.value == 168.4521
        assert s.unit == "g"
        assert s.stable is True

    def test_dynamic_sample(self) -> None:
        p = MettlerParser()
        out = p.feed(b"S D 168.40 g\r\n")
        assert len(out) == 1
        assert out[0].stable is False

    def test_partial_then_complete(self) -> None:
        p = MettlerParser()
        assert p.feed(b"S S 168.45") == []
        out = p.feed(b"21 g\r\n")
        assert len(out) == 1
        assert out[0].value == 168.4521

    def test_multiple_in_one_chunk(self) -> None:
        p = MettlerParser()
        out = p.feed(b"S S 1.0000 g\r\nS D 2.0000 g\r\n")
        assert [s.value for s in out] == [1.0, 2.0]
        assert [s.stable for s in out] == [True, False]

    def test_garbage_line_skipped(self) -> None:
        p = MettlerParser()
        out = p.feed(b"GARBAGE\r\nS S 5.0 g\r\n")
        assert len(out) == 1
        assert out[0].value == 5.0


class TestSartorius:
    def test_stable_with_plus(self) -> None:
        p = SartoriusParser()
        out = p.feed(b"+ 168.4521 g\r\n")
        assert len(out) == 1
        assert out[0].value == 168.4521
        assert out[0].stable is True

    def test_unstable_with_question(self) -> None:
        p = SartoriusParser()
        out = p.feed(b"? 168.4521 g\r\n")
        assert len(out) == 1
        assert out[0].stable is False

    def test_negative_value(self) -> None:
        p = SartoriusParser()
        out = p.feed(b"- 0.5 g\r\n")
        assert len(out) == 1
        # parser 把 sign 当稳定标记，value 自身用 regex 抓负号；这里 prefix='-' 取消负号
        # 实际固件会以 + 表示 sign + value 已含负号，行为按 + 算 stable
        assert out[0].stable is True

    def test_with_kg_unit(self) -> None:
        p = SartoriusParser()
        out = p.feed(b"+ 1.500 kg\r\n")
        assert out[0].unit == "kg"


class TestGeneric:
    def test_simple_value(self) -> None:
        p = GenericParser()
        out = p.feed(b"168.4521 g\r\n")
        assert len(out) == 1
        assert out[0].value == 168.4521

    def test_value_without_unit_uses_default(self) -> None:
        p = GenericParser(default_unit="mg")
        out = p.feed(b"100.5\r\n")
        assert out[0].unit == "mg"

    def test_st_gs_prefix(self) -> None:
        """common in CAS / OHAUS scales: 'ST,GS,+0123.456 g'"""
        p = GenericParser()
        out = p.feed(b"ST,GS,+0123.456 g\r\n")
        assert len(out) == 1
        assert out[0].value == 123.456


class TestFactory:
    def test_make_mettler(self) -> None:
        assert isinstance(make_parser("mettler"), MettlerParser)

    def test_make_sartorius(self) -> None:
        assert isinstance(make_parser("sartorius"), SartoriusParser)

    def test_make_generic_default(self) -> None:
        assert isinstance(make_parser("generic"), GenericParser)
