import type { Metadata } from 'next';
import Link from 'next/link';
import { HelpShell, Kbd, Pill, Section, Table } from '../ui';

export const metadata: Metadata = {
  title: 'Hướng dẫn sử dụng — X Flow Tool',
  description: 'Cách đăng nhập, tạo và chỉnh sửa sơ đồ, chạy hiệu ứng mô phỏng, lưu và chia sẻ sơ đồ trong X Flow Tool.',
};

const TOC = [
  ['start', 'Bắt đầu'],
  ['create', 'Tạo sơ đồ'],
  ['canvas', 'Thao tác trên canvas'],
  ['inspect', 'Chỉnh sửa khối & đường nối'],
  ['database', 'Sơ đồ cơ sở dữ liệu'],
  ['groups', 'Nhóm các khối'],
  ['run', 'Chạy mô phỏng'],
  ['save', 'Lưu công việc'],
  ['share', 'Chia sẻ sơ đồ'],
  ['json', 'Xuất file & công cụ JSON'],
  ['reference', 'Tra cứu nhanh'],
] as const;

export default function HelpViPage() {
  return (
    <HelpShell
      title='Hướng dẫn sử dụng'
      tagline='Mọi thứ bạn cần để tạo, chạy hiệu ứng và chia sẻ sơ đồ luồng'
      languageSwitch={{ href: '/help', label: 'English' }}
      authoringGuideLabel='Hướng dẫn viết JSON'
      backLabel='Về danh sách sơ đồ'
      toc={TOC}
    >
      <p className='max-w-2xl text-sm leading-relaxed text-zinc-400'>
        X Flow Tool là trình soạn thảo sơ đồ luồng có hiệu ứng động chạy trên trình duyệt — kiến trúc hệ thống, quy trình nghiệp vụ, pipeline CI/CD. Trang này hướng dẫn quy trình làm việc
        hằng ngày. Nếu bạn cần quy tắc để tự viết (hoặc dùng AI viết) JSON của sơ đồ, hãy xem{' '}
        <Link href='/guide' className='text-sky-300 underline-offset-2 hover:underline'>hướng dẫn viết JSON</Link> (tiếng Anh).
      </p>

      <Section id='start' title='1. Bắt đầu'>
        <p>
          Đăng nhập bằng <strong>tài khoản Google</strong> hoặc <strong>email + mật khẩu</strong>. Mỗi sơ đồ bạn tạo thuộc về tài khoản của bạn và được lưu trên cloud — không ai khác mở hay
          sửa được, trừ khi bạn chủ động đặt nó ở chế độ công khai.
        </p>
        <p>
          Sau khi đăng nhập, bạn vào <strong>danh sách sơ đồ</strong>: bảng liệt kê mọi sơ đồ bạn sở hữu, kèm số khối/đường nối, trạng thái công khai, thời gian tạo và cập nhật. Tại đây bạn
          có thể:
        </p>
        <ul className='list-disc space-y-1.5 pl-5'>
          <li>Bấm vào tên một sơ đồ để mở nó trong trình soạn thảo.</li>
          <li>Tìm kiếm theo tên hoặc id, sắp xếp theo bất kỳ cột nào, và phân trang khi danh sách dài.</li>
          <li>
            Dùng menu <Pill>⋯</Pill> ở cuối mỗi dòng để <strong>Edit</strong> (sửa), <strong>View</strong> (mở trang xem chỉ-đọc trong tab mới), <strong>Share</strong> (chia sẻ — chỉ với sơ đồ
            công khai) và <strong>Delete</strong> (xoá).
          </li>
        </ul>
      </Section>

      <Section id='create' title='2. Tạo sơ đồ'>
        <ul className='list-disc space-y-1.5 pl-5'>
          <li>
            <strong>New diagram</strong> — bắt đầu từ canvas trống.
          </li>
          <li>
            <strong>New from template</strong> — bắt đầu từ sơ đồ dựng sẵn (HRM, CRM, kiến trúc phần mềm, thương mại điện tử, CI/CD…). Template sau khi nạp vẫn chỉnh sửa được hoàn toàn: di
            chuyển và đổi kích thước khối, đổi hình dạng, nối lại các khối, đổi hiệu ứng đường nối.
          </li>
        </ul>
        <p>
          Cả hai nút nằm ở trang danh sách sơ đồ; trong trình soạn thảo, các lệnh tương tự nằm trong menu <strong>File</strong>. Để đổi tên sơ đồ, bấm vào tên nó trên thanh header, gõ tên mới
          rồi nhấn <Kbd>Enter</Kbd> (hoặc <Kbd>Esc</Kbd> để huỷ).
        </p>
      </Section>

      <Section id='canvas' title='3. Thao tác trên canvas'>
        <p>
          <strong>Thêm khối:</strong> chọn một hình từ thanh công cụ ở đáy canvas — dùng các nút vẽ nhanh (chữ nhật, bo góc, viên thuốc, thoi) hoặc mở lưới đầy đủ trong dropdown (lục giác,
          trụ, đám mây, tài liệu, ngôi sao…). Con trỏ chuyển thành dấu cộng; bấm-kéo trên canvas để vẽ khối với kích thước tuỳ ý. Công cụ tự tắt sau mỗi lần vẽ, nên hãy chọn lại hình cho khối
          tiếp theo. Nhấn <Kbd>Esc</Kbd> để huỷ công cụ đang chọn.
        </p>
        <p>
          <strong>Thêm chữ tự do:</strong> nút <strong>T</strong> ở cuối thanh dock đặt một đoạn chữ trần lên canvas — không khung, không viền, không cổng nối, chỉ có chữ. Dùng cho tiêu đề,
          chú thích, ghi chú. Cách vẽ vẫn như cũ (kéo thả để định vùng chữ, bấm một cái thì được khung mặc định), rồi gõ nội dung vào ô <strong>Text</strong> trong Inspector; nhấn Enter trong
          ô đó để xuống dòng. Cỡ chữ, font, độ đậm, màu và canh lề dùng chung các điều khiển typography quen thuộc. Chữ là phần trang trí chứ không phải một bước, nên thanh Play để nó hiển
          thị suốt quá trình chạy.
        </p>
        <p>
          <strong>Di chuyển &amp; đổi kích thước:</strong> kéo khối để di chuyển. Chọn khối trước để hiện bốn tay nắm ở góc, rồi kéo tay nắm để đổi kích thước.
        </p>
        <p>
          <strong>Nối các khối:</strong> rê chuột lên một khối để hiện các cổng kết nối, rồi kéo từ cổng sang khối khác. Một đường nối mờ chạy theo con trỏ, và cổng vào của khối đích sẽ nhấp
          nháy khi thả chuột sẽ tạo kết nối. Bạn cũng có thể kéo đầu mút của một đường nối sẵn có để gắn lại sang khối khác.
        </p>
        <p>
          <strong>Uốn đường nối:</strong> bấm đúp vào một đường đang chọn để thêm <em>điểm uốn</em> tại đó, kéo các điểm uốn để lượn đường tránh các khối khác, và bấm đúp vào một điểm uốn để
          xoá nó.
        </p>
        <p>
          <strong>Điều hướng:</strong> kéo vùng canvas trống để di chuyển khung nhìn (kéo bằng chuột giữa hoạt động ở mọi nơi), lăn chuột để thu phóng, và dùng cụm nút góc canvas để{' '}
          <em>Zoom in / Zoom out / Fit diagram to view</em>. Cụm điều khiển lưới bên cạnh dùng để bật/tắt bắt dính và chọn cỡ lưới.
        </p>
      </Section>

      <Section id='inspect' title='4. Chỉnh sửa khối & đường nối'>
        <p>
          Bấm vào một khối hoặc một đường nối sẽ mở <strong>bảng thuộc tính (inspector)</strong> bên phải — mọi tuỳ chỉnh giao diện nằm ở đó.
        </p>
        <ul className='list-disc space-y-1.5 pl-5'>
          <li>
            <strong>Bảng thuộc tính khối:</strong> tiêu đề và mô tả, hình dạng, bảng màu hoặc màu tuỳ chỉnh, icon (bộ chọn có tìm kiếm với đầy đủ thư viện Lucide và Tabler), kích thước, phông
            chữ, xoay, cạnh kết nối (đường nối vào/ra ở cạnh nào), và thứ tự thực thi. Kèm hai nút <strong>Duplicate</strong> (nhân bản) và <strong>Delete</strong> (xoá).
          </li>
          <li>
            <strong>Hiệu ứng khối:</strong> khối, khung nhóm và chữ đều bắt đầu ở trạng thái hoàn toàn tĩnh — không phát sáng, không chuyển động. Bộ chọn <strong>Effect</strong> hoạt động y hệt
            bộ chọn hiệu ứng cho đường nối: mở ra rồi chọn giữa nhóm <em>motion</em> (chính khối chuyển động: float, breathe, bounce, wobble, shake, blink) và nhóm <em>decoration</em> (vẽ thêm
            một lớp quanh khối: glow, pulse, ripple, trace, sheen). Có ô xem trước trực tiếp trước khi bấm Apply, cùng ba thông số <strong>Speed</strong>, <strong>Intensity</strong> và{' '}
            <strong>Effect colour</strong>. Dùng để làm nổi bật một khối — nếu khối nào cũng nhấp nháy thì chẳng khối nào nổi bật.
          </li>
          <li>
            <strong>Bảng thuộc tính đường nối:</strong> nhãn, hiệu ứng động (comet, dots, pulse, wave, scanner, binary và hơn chục kiểu khác), kiểu đi dây (thẳng, cong, vuông góc,
            smooth-step), chiều chạy (xuôi / ngược / cả hai), mũi tên hai đầu, độ dày nét, cỡ vật thể hiệu ứng, hình dạng vật thể chạy trên đường nối (mũi tên, phong bì, đồng xu…), số lượng vật thể, mật độ hoạ tiết, độ sáng và màu quầng neon, độ lệch pha và tốc độ chuyển động — cùng nút <strong>Delete</strong>.
          </li>
        </ul>
        <p>
          Mẹo: sơ đồ dễ đọc nhất khi dùng một họ hình dạng và một bảng màu nhỏ, nhất quán. <Link href='/guide' className='text-sky-300 underline-offset-2 hover:underline'>Hướng dẫn viết JSON</Link>{' '}
          liệt kê đầy đủ các quy ước hình ảnh mà những template dựng sẵn tuân theo.
        </p>
      </Section>

      <Section id='database' title='5. Sơ đồ cơ sở dữ liệu (ERD)'>
        <p>
          Cùng canvas đó vẽ được sơ đồ quan hệ thực thể. Nút <strong>Table</strong> ở bên phải thanh công cụ hình vẽ ra một bảng CSDL thay vì khối thường: bấm-kéo là có ngay thẻ bảng với ba
          cột mẫu <Pill>id</Pill> / <Pill>name</Pill> / <Pill>created_at</Pill>. Khối thường có thể chuyển thành bảng bằng nút <strong>Convert to database table</strong> trong bảng thuộc tính,
          và bảng cũng quay về khối thường theo cách tương tự.
        </p>
        <p>
          Chọn một bảng, bảng thuộc tính sẽ hiện mục <strong>Columns</strong>: tên cột, kiểu dữ liệu (nhập tự do, có sẵn danh sách gợi ý nên dùng được với mọi hệ CSDL), các nút bật/tắt{' '}
          <strong>PK · FK · U · IX · NULL</strong>, giá trị mặc định, cùng nút đổi thứ tự và xoá. Thẻ bảng tự co giãn theo số cột nên không bao giờ bị cụt dòng. Ô <strong>schema</strong> (tuỳ
          chọn) hiển thị cạnh tên bảng.
        </p>
        <p>
          <strong>Quan hệ</strong> chính là đường nối thông thường giữa hai bảng. Chọn đường nối, bảng thuộc tính sẽ có thêm khối Relationship để chọn cột ở mỗi đầu — việc này tự điền nhãn cho
          đường (<Pill>id → user_id</Pill>) và quyết định khoá ngoại khi xuất SQL. Nút <strong>One-to-many ends</strong> đặt ký hiệu chân quạ cho cả hai đầu chỉ bằng một cú bấm; bộ đầy đủ (một,
          nhiều, một-hoặc-nhiều, không-hoặc-một, không-hoặc-nhiều) nằm trong hai ô chọn Line start / Line end.
        </p>
        <p>
          <strong>File → Export SQL</strong> chuyển cả sơ đồ thành script <Pill>CREATE TABLE</Pill> — cột kèm NOT NULL / DEFAULT / UNIQUE, khoá chính, index, và khoá ngoại dạng ALTER TABLE —
          sẵn sàng để sao chép hoặc tải về dưới dạng file <Pill>.sql</Pill>. Kiểu dữ liệu giữ nguyên đúng như bạn gõ. Muốn bắt đầu từ một sơ đồ hoàn chỉnh,
          quản trị viên có thể nhập sẵn tài liệu <strong>Database Schema</strong> từ thư mục <Pill>seed/templates/</Pill> trong repository — sau đó nó xuất hiện trong{' '}
          <strong>New from template</strong> cho mọi người.
        </p>
      </Section>

      <Section id='groups' title='6. Nhóm khối (khối lồng trong khối)'>
        <p>
          Nút <strong>Group</strong> ở ngoài cùng bên phải thanh dock vẽ ra một <em>khung nhóm</em> — một khối chứa các khối khác bên trong, dùng cho một hệ thống con, một swimlane hay một
          phân vùng nghiệp vụ. Kéo thả để vẽ khung ở bất kỳ đâu; nếu bạn vẽ bao quanh các khối có sẵn thì chúng vào nhóm ngay lập tức.
        </p>
        <Table
          head={['Bạn muốn', 'Cách làm']}
          rows={[
            ['Cho một khối vào nhóm', 'Kéo khối thả vào trong khung. Khối thuộc về khung nào là tuỳ tâm điểm của nó rơi vào khung đó.'],
            ['Đưa một khối ra khỏi nhóm', 'Kéo khối ra ngoài khung rồi thả ở vùng trống. Hoặc bấm Remove from group trong Inspector.'],
            ['Di chuyển cả hệ thống con', 'Kéo khung bằng thanh tiêu đề hoặc đường viền: mọi thứ bên trong đi theo, giữ nguyên khoảng cách tương đối.'],
            ['Đổi kích thước khung', 'Chọn khung rồi kéo một trong 4 góc, hoặc bấm Fit to contents trong Inspector để khung tự ôm sát nội dung.'],
            ['Lồng nhiều tầng', 'Thả một khung vào trong khung khác. Lồng bao nhiêu tầng cũng được; một khung không bao giờ chui được vào chính nó.'],
            ['Rã nhóm', 'Ungroup trong Inspector thả tự do mọi khối và giữ lại khung rỗng. Còn xoá khung thì xoá luôn những gì bên trong.'],
          ]}
        />
        <p>
          Khung nhóm là vật chứa chứ không phải một bước: thanh Play bỏ qua nó, khung hiển thị suốt quá trình chạy, và khung không có cổng nối — hãy nối đường giữa các khối. Phần ruột của
          khung cũng cho click xuyên qua, nên khối và đường bên trong vẫn chọn được bình thường; khi muốn chọn chính khung thì bấm vào thanh tiêu đề hoặc đường viền nét đứt.
        </p>
      </Section>

      <Section id='run' title='7. Chạy mô phỏng'>
        <p>
          Mọi sơ đồ đều có thể <em>chạy</em>: các khối lần lượt sáng lên và các đường nối tự vẽ theo thứ tự thực thi — rất hợp để thuyết trình một quy trình theo từng bước. Cụm điều khiển
          phát nằm trên thanh header của trình soạn thảo:
        </p>
        <Table
          head={['Nút', 'Tác dụng']}
          rows={[
            ['Sequential', 'Các bước tự chạy theo bộ đếm thời gian, mỗi lần một bước. Các khối có cùng thứ tự thực thi chạy cùng nhau trong một bước (nhánh song song).'],
            ['Concurrent', 'Mọi thứ chạy hiệu ứng cùng lúc — hữu ích để nhìn cả hệ thống "sống" một lượt.'],
            ['Manual', 'Không có gì tự chạy cho đến khi bạn bấm Next — bạn tự điều khiển từng bước, lý tưởng khi thuyết trình.'],
            ['Next', 'Chỉ trong chế độ Manual: chạy bước thực thi kế tiếp.'],
            ['Repeat', 'Chỉ trong chế độ Sequential: tự động chạy lại sau khi hoàn thành.'],
            ['Replay', 'Chạy lại hiệu ứng từ đầu, ở mọi chế độ.'],
          ]}
        />
        <p>
          Thứ tự chạy hiệu ứng lấy từ <strong>thứ tự thực thi</strong> của mỗi khối (đặt trong bảng thuộc tính khối). Các khối cùng số chạy trong cùng một bước — hãy tận dụng điều này để thể
          hiện các việc diễn ra song song.
        </p>
      </Section>

      <Section id='save' title='8. Lưu công việc'>
        <ul className='list-disc space-y-1.5 pl-5'>
          <li>
            <strong>Save</strong> (nút trên header) ghi sơ đồ lên cloud. Chấm vàng trên nút nghĩa là bạn còn thay đổi chưa lưu.
          </li>
          <li>
            <strong>Tự lưu phiên làm việc:</strong> các chỉnh sửa dở dang cũng được giữ tạm trong trình duyệt, nên lỡ tay tải lại trang hay đóng tab không làm mất việc — trình soạn thảo khôi
            phục đúng chỗ bạn dừng. Đây chỉ là lưới an toàn, không phải lưu cloud: hãy bấm <strong>Save</strong> để lưu thật sự.
          </li>
          <li>
            <strong>File → Save as</strong> nhân bản tài liệu hiện tại thành một sơ đồ hoàn toàn mới (&quot;… copy&quot;) và mở nó.
          </li>
          <li>
            <strong>File → Reset</strong> vứt bỏ mọi thay đổi chưa lưu và đưa canvas về trạng thái nạp gần nhất. Có hộp thoại xác nhận — thao tác này không hoàn tác được.
          </li>
        </ul>
      </Section>

      <Section id='share' title='9. Chia sẻ sơ đồ'>
        <p>Sơ đồ mặc định ở chế độ <strong>riêng tư (Private)</strong> — chỉ bạn (và quản trị viên) mở được. Để chia sẻ:</p>
        <ul className='list-disc space-y-1.5 pl-5'>
          <li>
            Trên header trình soạn thảo, bấm nút chuyển <strong>Private / Public</strong> để đặt sơ đồ công khai, rồi lưu.
          </li>
          <li>
            Mở <strong>File → Share</strong> (hoặc lệnh <strong>Share</strong> trong menu dòng ở danh sách sơ đồ) và sao chép liên kết. Liên kết mở <strong>trang xem chỉ-đọc</strong> — người
            xem theo dõi được hiệu ứng nhưng không bao giờ sửa được; đặt công khai không cấp quyền sửa cho bất kỳ ai.
          </li>
          <li>Chuyển về <strong>Private</strong> bất cứ lúc nào để thu hồi liên kết.</li>
        </ul>
      </Section>

      <Section id='json' title='10. Xuất file & công cụ JSON'>
        <p>
          Bên dưới, mỗi sơ đồ là một tài liệu JSON duy nhất. <strong>File → Export to JSON</strong> tải nó về dưới dạng file <Pill>.json</Pill> — tiện để sao lưu, đưa vào version control,
          hoặc sửa tay.
        </p>
        <p>
          Nút <strong>Info</strong> trên cụm điều khiển canvas mở panel bên gồm phần tóm tắt tài liệu, khung JSON trực tiếp cập nhật theo từng chỉnh sửa, và JSON playground để dán một tài
          liệu vào canvas. Schema chi tiết từng trường được ghi trong <Link href='/guide' className='text-sky-300 underline-offset-2 hover:underline'>hướng dẫn viết JSON</Link>.
        </p>
      </Section>

      <Section id='reference' title='11. Tra cứu nhanh'>
        <Table
          head={['Thao tác', 'Cách làm']}
          rows={[
            ['Thêm khối', 'Chọn hình ở thanh công cụ đáy canvas, rồi bấm-kéo trên canvas'],
            ['Huỷ công cụ vẽ đang chọn', 'Esc, hoặc bấm lại vào công cụ đang bật'],
            ['Nối hai khối', 'Kéo từ cổng của khối này sang khối kia'],
            ['Uốn đường nối', 'Chọn đường, bấm đúp lên đường để thêm điểm uốn; kéo điểm uốn; bấm đúp vào điểm uốn để xoá'],
            ['Sửa khối / đường nối', 'Bấm vào nó — bảng thuộc tính mở bên phải'],
            ['Nhân bản hoặc xoá', 'Các nút ở đầu bảng thuộc tính'],
            ['Di chuyển khung nhìn', 'Kéo vùng canvas trống (hoặc kéo bằng chuột giữa ở mọi nơi)'],
            ['Thu phóng', 'Lăn chuột, hoặc các nút Zoom in / Zoom out / Fit'],
            ['Đổi tên sơ đồ', 'Bấm vào tên trên header, gõ, nhấn Enter'],
            ['Lưu lên cloud', 'Nút Save trên header (chấm vàng = còn thay đổi chưa lưu)'],
            ['Chạy hiệu ứng', 'Replay — chọn Sequential, Concurrent hoặc Manual trước'],
            ['Chia sẻ chỉ-đọc', 'Đặt sơ đồ Public, rồi File → Share → Copy'],
            ['Vẽ một bảng CSDL', 'Nút Table bên phải thanh công cụ hình, rồi bấm-kéo'],
            ['Sửa các cột', 'Chọn bảng — mục Columns nằm trong bảng thuộc tính'],
            ['Nối hai bảng', 'Nối chúng lại, rồi chọn cột ở mỗi đầu trong khối Relationship'],
            ['Lấy mã SQL', 'File → Export SQL → Copy hoặc Download .sql'],
          ]}
        />
      </Section>
    </HelpShell>
  );
}
