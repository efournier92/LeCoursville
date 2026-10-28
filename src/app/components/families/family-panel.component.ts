import { Component, EventEmitter, Input, Output, ChangeDetectionStrategy } from '@angular/core';
import { FamilyPerson } from 'src/app/services/family-archive.service';
import { personName } from './family-chart.component';

@Component({
  selector: 'app-family-panel',
  templateUrl: './family-panel.component.html',
  styleUrls: ['./family-panel.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class FamilyPanelComponent {
  @Input() person: FamilyPerson | null = null;
  @Input() people: Record<string, FamilyPerson> | null = null;
  @Output() select = new EventEmitter<string>();

  personName = personName;

  sexLabel(sex: string | null | undefined): string {
    if (sex === 'M') {
      return 'Male';
    }
    if (sex === 'F') {
      return 'Female';
    }
    return '';
  }

  relative(id: string | null | undefined): FamilyPerson | null {
    return (id && this.people?.[id]) || null;
  }

  relatives(ids: string[] | null | undefined): { id: string; label: string }[] {
    return (ids || [])
      .filter(id => this.people?.[id])
      .map(id => ({ id, label: personName(this.people![id]) }));
  }

  marriageEntries(person: FamilyPerson): { spouse: string; year: number }[] {
    return Object.entries(person.marriageYears || {}).map(([spouse, year]) => ({ spouse, year }));
  }

  onSelect(id: string): void {
    this.select.emit(id);
  }
}
