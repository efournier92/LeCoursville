import { Component, OnInit } from '@angular/core';
import { Expression } from 'src/app/models/expression';

@Component({
  selector: 'app-expressions',
  templateUrl: './expressions.component.html',
  styleUrls: ['./expressions.component.scss']
})
export class ExpressionsComponent implements OnInit {
  expressions: Expression[];

  constructor() { }

  ngOnInit(): void {
    const title = 'Kissed His Bague';
    const body = '"Kissed his bague" has remained a true classic of an expression. The phrase originates from the French word for ring (\'bague\' may be the French spelling) and the custom of Roman Catholics to kiss the ring of a high ranking prelate of the Church. The expression has provoked more than a little amusement when deftly employed by some of the LeCoursville citizenry.';
    const authorName = 'Richard LeCours';
    const yearWritten = '1984';
    const attribution = 'Annette Miller';
    const type = 'expression';

    const expression = new Expression(title, body, authorName, yearWritten, attribution);
    this.expressions = [expression, expression]
  }
}
