// receipt-aggregation の単体テスト。
// 実行: `node --test --experimental-strip-types src/libs/receipt-aggregation.test.ts`
// （Node 24 標準の test runner + native TS を使い、devDependency 追加なしで動かす）
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { aggregateLines } from "./receipt-aggregation.ts";

describe("aggregateLines", () => {
	it("単一税率 10% を正しく集計する", () => {
		const result = aggregateLines([{ taxRate: 10, amountTaxIncl: 1100 }]);
		assert.equal(result.amount, 1100);
		assert.equal(result.taxAmount, 100);
		assert.equal(result.taxRateCategory, "10");
	});

	it("単一税率 8% を正しく集計する", () => {
		const result = aggregateLines([{ taxRate: 8, amountTaxIncl: 540 }]);
		assert.equal(result.amount, 540);
		assert.equal(result.taxAmount, 40);
		assert.equal(result.taxRateCategory, "8");
	});

	it("8% / 10% 混在で mixed カテゴリになり、税額は両者の合計", () => {
		const result = aggregateLines([
			{ taxRate: 10, amountTaxIncl: 1100 },
			{ taxRate: 8, amountTaxIncl: 540 },
		]);
		assert.equal(result.amount, 1640);
		assert.equal(result.taxAmount, 140);
		assert.equal(result.taxRateCategory, "mixed");
	});

	it("税率 0% の単一行は category=null、税額=0", () => {
		const result = aggregateLines([{ taxRate: 0, amountTaxIncl: 1000 }]);
		assert.equal(result.amount, 1000);
		assert.equal(result.taxAmount, 0);
		assert.equal(result.taxRateCategory, null);
	});

	it("税率 0% と 10% の混在は mixed、税額は10%分のみ", () => {
		const result = aggregateLines([
			{ taxRate: 0, amountTaxIncl: 500 },
			{ taxRate: 10, amountTaxIncl: 1100 },
		]);
		assert.equal(result.amount, 1600);
		assert.equal(result.taxAmount, 100);
		assert.equal(result.taxRateCategory, "mixed");
	});

	it("同一税率の複数行は合算され、カテゴリはその税率", () => {
		const result = aggregateLines([
			{ taxRate: 10, amountTaxIncl: 550 },
			{ taxRate: 10, amountTaxIncl: 1100 },
		]);
		assert.equal(result.amount, 1650);
		assert.equal(result.taxAmount, 150);
		assert.equal(result.taxRateCategory, "10");
	});

	it("0件はエラーになる (REQ-RC-01 不変条件)", () => {
		assert.throws(() => aggregateLines([]), /REQ-RC-01/);
	});
});
