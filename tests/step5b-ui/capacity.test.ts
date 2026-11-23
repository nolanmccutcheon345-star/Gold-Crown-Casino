import {describe,expect,it} from 'vitest';
import {tableSeatSlots} from '../../src/ui/table-capacity';
import {perimeterLayout,layoutRectangles} from '../../src/ui/table-layout';

describe('Physical table capacity is independent of occupancy (D02)',()=>{
  it('keeps six occupied positions and four distinguishable empty positions in a ten-seat perimeter',()=>{
    const slots=tableSeatSlots(10,[0,2,3,5,7,9]);
    expect(slots.filter(slot=>slot.occupied).map(slot=>slot.id)).toEqual([0,2,3,5,7,9]);
    expect(slots.filter(slot=>!slot.occupied).map(slot=>slot.id)).toEqual([1,4,6,8]);
    expect(slots[0]).toEqual({id:0,occupied:true,hero:true});
  });
  it.each([2,3,6,9,10])('keeps Hero bottom for %s physical seats at all requested mobile widths',capacity=>{
    const slots=tableSeatSlots(capacity,[0,capacity-1]);
    for(const width of [320,375,390,430]){
      const layout=perimeterLayout(slots.length,true),rectangles=layoutRectangles(layout,width);
      expect(layout.points[0].y).toBe(1);
      expect(layout.points.every(point=>point.x>=0&&point.x<=1&&point.y>=0&&point.y<=1)).toBe(true);
      expect(rectangles.seats.length).toBe(capacity);
    }
  });
  it.each([[10,[0,0]],[6,[0,7]],[6,[1,2]],[6,[0]],[11,[0,1]]])('rejects invalid capacity or occupancy %j %j',(capacity,ids)=>{
    expect(()=>tableSeatSlots(capacity as number,ids as number[])).toThrow();
  });
});
