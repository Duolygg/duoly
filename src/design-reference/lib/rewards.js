// Customer loyalty levels: same order counts as the teammate trust levels.
// cashback = % of every order paid back as gifted wallet balance; gift = one-off gifted balance on reaching the level.
// Shared by the server (wallet + cashback in lib/orders.js) and the browser (Rewards card).
export const LEVELS = [
  { id: 'bronze', name: 'Bronze', from: 0, cashback: 1, gift: 0, color: '#E8A37C',
    card: 'linear-gradient(135deg, #F6CDB0 0%, #CF8A63 42%, #F2BC98 68%, #A8623F 100%)' },
  { id: 'silver', name: 'Silver', from: 100, cashback: 2, gift: 5, color: '#D9E1F2',
    card: 'linear-gradient(135deg, #F7F9FD 0%, #B9C1D3 40%, #ECEFF6 66%, #96A0B6 100%)' },
  { id: 'gold', name: 'Gold', from: 250, cashback: 3, gift: 15, color: '#FFD27A',
    card: 'linear-gradient(135deg, #FFF3CC 0%, #E8B850 42%, #FFE29A 66%, #BF8829 100%)' },
  { id: 'platinum', name: 'Platinum', from: 500, cashback: 5, gift: 40, color: '#9EE6FF',
    card: 'linear-gradient(135deg, #EAFBFF 0%, #8ED5EE 40%, #D5F4FF 66%, #5BAFCE 100%)' },
  { id: 'diamond', name: 'Diamond', from: 1000, cashback: 7, gift: 100, color: '#D6BBFF',
    card: 'linear-gradient(135deg, #F6EEFF 0%, #B996FF 38%, #F2CCFF 62%, #8962F0 100%)' }
];

export function levelFor(orders) {
  let l = LEVELS[0];
  LEVELS.forEach((x) => { if (orders >= x.from) l = x; });
  return l;
}
